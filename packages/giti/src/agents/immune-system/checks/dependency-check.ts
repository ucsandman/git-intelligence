import simpleGit from 'simple-git';
import type { CheckResult } from '../types.js';
import { runCommand } from '../../utils.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function getAllDeps(pkg: PackageJson): Set<string> {
  const deps = new Set<string>();
  if (pkg.dependencies) {
    for (const name of Object.keys(pkg.dependencies)) {
      deps.add(name);
    }
  }
  if (pkg.devDependencies) {
    for (const name of Object.keys(pkg.devDependencies)) {
      deps.add(name);
    }
  }
  return deps;
}

function findNewDeps(mainPkg: PackageJson, branchPkg: PackageJson): string[] {
  const mainDeps = getAllDeps(mainPkg);
  const branchDeps = getAllDeps(branchPkg);

  const newDeps: string[] = [];
  for (const dep of branchDeps) {
    if (!mainDeps.has(dep)) {
      newDeps.push(dep);
    }
  }
  return newDeps;
}

export async function runDependencyCheck(
  repoPath: string,
  branch: string,
): Promise<CheckResult> {
  const name = 'Dependencies';
  const git = simpleGit(repoPath);

  // 1. Get package.json from main and branch
  let mainPkgRaw: string;
  let branchPkgRaw: string;
  try {
    mainPkgRaw = await git.show(['main:package.json']);
  } catch {
    return {
      name,
      status: 'pass',
      message: 'No package.json on main branch',
    };
  }

  try {
    branchPkgRaw = await git.show([branch + ':package.json']);
  } catch {
    return {
      name,
      status: 'pass',
      message: 'No package.json on branch',
    };
  }

  // 2. Parse both
  let mainPkg: PackageJson;
  let branchPkg: PackageJson;
  try {
    mainPkg = JSON.parse(mainPkgRaw) as PackageJson;
    branchPkg = JSON.parse(branchPkgRaw) as PackageJson;
  } catch {
    return {
      name,
      status: 'warn',
      message: 'Could not parse package.json for comparison',
    };
  }

  // 3. Find new dependencies
  const newDeps = findNewDeps(mainPkg, branchPkg);

  if (newDeps.length === 0) {
    return {
      name,
      status: 'pass',
      message: 'No new dependencies',
    };
  }

  // 4. Run npm audit to check for vulnerabilities in new deps
  const auditResult = runCommand('npm', ['audit', '--json'], repoPath);
  let hasVulnerableDep = false;

  try {
    const audit = JSON.parse(auditResult.stdout) as {
      vulnerabilities?: Record<string, { severity?: string }>;
    };

    if (audit.vulnerabilities) {
      for (const dep of newDeps) {
        if (audit.vulnerabilities[dep]) {
          hasVulnerableDep = true;
          break;
        }
      }
    }
  } catch {
    // If audit can't be parsed, just warn about new deps
  }

  if (hasVulnerableDep) {
    return {
      name,
      status: 'fail',
      message: `New dependency has known vulnerabilities: ${newDeps.join(', ')}`,
      details: { new_dependencies: newDeps },
    };
  }

  return {
    name,
    status: 'warn',
    message: `${newDeps.length} new dependencies added: ${newDeps.join(', ')}`,
    details: { new_dependencies: newDeps },
  };
}
