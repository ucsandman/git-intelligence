import fs from 'node:fs/promises';
import path from 'node:path';
import type { StateReport } from '../types.js';
import { runCommand } from '../../utils.js';

type TestHealthResult = Pick<StateReport['quality'], 'test_pass_rate' | 'test_coverage_percent' | 'lint_error_count'>;

export async function collectTestHealth(repoPath: string): Promise<TestHealthResult> {
  const [passRate, coverage, lintErrors] = await Promise.all([
    collectPassRate(repoPath),
    collectCoverage(repoPath),
    collectLintErrors(repoPath),
  ]);

  return {
    test_pass_rate: passRate,
    test_coverage_percent: coverage,
    lint_error_count: lintErrors,
  };
}

async function collectPassRate(repoPath: string): Promise<number> {
  try {
    // In a monorepo, vitest must run from the package directory (where
    // vitest.config.ts lives) rather than the repo root. The root has no
    // config, so globals like describe/it are undefined and every test file
    // fails to load — producing a false test_pass_rate of 0.
    const gitiPkg = path.join(repoPath, 'packages', 'giti');
    const testDir = await fs.stat(gitiPkg).then(() => gitiPkg).catch(() => repoPath);
    const result = runCommand('npx', ['vitest', 'run', '--reporter=json'], testDir);
    if (!result.stdout) return 0;

    const parsed = JSON.parse(result.stdout) as {
      numPassedTests?: number;
      numTotalTests?: number;
    };

    const passed = parsed.numPassedTests ?? 0;
    const total = parsed.numTotalTests ?? 0;
    if (total === 0) return 0;

    return passed / total;
  } catch {
    return 0;
  }
}

async function collectCoverage(repoPath: string): Promise<number> {
  try {
    const gitiPkg = path.join(repoPath, 'packages', 'giti');
    const testDir = await fs.stat(gitiPkg).then(() => gitiPkg).catch(() => repoPath);
    runCommand('npx', ['vitest', 'run', '--coverage', '--reporter=json'], testDir);
    const coveragePath = path.join(testDir, 'coverage', 'coverage-summary.json');
    const raw = await fs.readFile(coveragePath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      total?: { statements?: { pct?: number } };
    };
    return parsed.total?.statements?.pct ?? 0;
  } catch {
    return 0;
  }
}

async function collectLintErrors(repoPath: string): Promise<number> {
  try {
    const gitiPkg = path.join(repoPath, 'packages', 'giti');
    const testDir = await fs.stat(gitiPkg).then(() => gitiPkg).catch(() => repoPath);
    const result = runCommand('npx', ['tsc', '--noEmit'], testDir);
    if (result.status === 0) return 0;

    const errorPattern = /error TS\d+/g;
    const matches = result.stderr.match(errorPattern);
    return matches?.length ?? 0;
  } catch {
    return 0;
  }
}
