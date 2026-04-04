import fs from 'node:fs/promises';
import path from 'node:path';
import type { StateReport, OutdatedPackage, Vulnerability } from '../types.js';
import { runCommand } from '../../utils.js';

export async function collectDependencyHealth(
  repoPath: string,
): Promise<StateReport['dependencies']> {
  const [totalCount, outdatedPackages, vulnerabilities] = await Promise.all([
    countTotalDeps(repoPath),
    collectOutdated(repoPath),
    collectVulnerabilities(repoPath),
  ]);

  return {
    total_count: totalCount,
    outdated_count: outdatedPackages.length,
    vulnerable_count: vulnerabilities.length,
    outdated_packages: outdatedPackages,
    vulnerabilities,
  };
}

async function countTotalDeps(repoPath: string): Promise<number> {
  try {
    const pkgPath = path.join(repoPath, 'package.json');
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys(pkg.dependencies ?? {}).length;
    const devDeps = Object.keys(pkg.devDependencies ?? {}).length;
    return deps + devDeps;
  } catch {
    return 0;
  }
}

function collectOutdated(repoPath: string): Promise<OutdatedPackage[]> {
  try {
    // npm outdated exits code 1 when packages are outdated — parse stdout regardless
    const result = runCommand('npm', ['outdated', '--json'], repoPath);
    if (!result.stdout || result.stdout.trim() === '') return Promise.resolve([]);

    const parsed = JSON.parse(result.stdout) as Record<
      string,
      { current: string; wanted: string; latest: string }
    >;

    const packages: OutdatedPackage[] = [];
    for (const [name, info] of Object.entries(parsed)) {
      packages.push({
        name,
        current: info.current,
        latest: info.latest,
        severity: determineSeverity(info.current, info.latest),
      });
    }

    return Promise.resolve(packages);
  } catch {
    return Promise.resolve([]);
  }
}

function collectVulnerabilities(repoPath: string): Promise<Vulnerability[]> {
  try {
    const result = runCommand('npm', ['audit', '--json'], repoPath);
    if (!result.stdout || result.stdout.trim() === '') return Promise.resolve([]);

    const parsed = JSON.parse(result.stdout) as {
      vulnerabilities?: Record<
        string,
        { severity: string; via: Array<{ title?: string } | string> }
      >;
    };

    if (!parsed.vulnerabilities) return Promise.resolve([]);

    const vulns: Vulnerability[] = [];
    for (const [pkg, info] of Object.entries(parsed.vulnerabilities)) {
      const description = info.via
        .map((v) => (typeof v === 'string' ? v : v.title ?? 'Unknown'))
        .join(', ');

      vulns.push({
        package: pkg,
        severity: info.severity,
        description,
      });
    }

    return Promise.resolve(vulns);
  } catch {
    return Promise.resolve([]);
  }
}

export function determineSeverity(current: string, latest: string): 'patch' | 'minor' | 'major' {
  const currentParts = parseSemver(current);
  const latestParts = parseSemver(latest);

  if (currentParts.major !== latestParts.major) return 'major';
  if (currentParts.minor !== latestParts.minor) return 'minor';
  return 'patch';
}

function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const cleaned = version.replace(/^[^0-9]*/, '');
  const parts = cleaned.split('.');
  return {
    major: parseInt(parts[0] ?? '0', 10),
    minor: parseInt(parts[1] ?? '0', 10),
    patch: parseInt(parts[2] ?? '0', 10),
  };
}
