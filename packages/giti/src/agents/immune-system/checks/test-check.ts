import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheckResult } from '../types.js';
import type { Baselines } from '../types.js';
import type { OrganismConfig } from '../../types.js';
import { runCommand } from '../../utils.js';

export async function runTestCheck(
  repoPath: string,
  baselines: Baselines | null,
  config: OrganismConfig,
): Promise<CheckResult> {
  const name = 'Tests';

  // 1. Run vitest for the giti package only and parse JSON output
  const gitiPath = path.join(repoPath, 'packages', 'giti');
  const testResult = runCommand('npx', ['vitest', 'run', '--reporter=json'], gitiPath);

  let totalTests = 0;
  let failedTests = 0;

  try {
    const parsed = JSON.parse(testResult.stdout) as {
      numTotalTests?: number;
      numFailedTests?: number;
      numPassedTests?: number;
    };
    totalTests = parsed.numTotalTests ?? 0;
    failedTests = parsed.numFailedTests ?? 0;
  } catch {
    return {
      name,
      status: 'fail',
      message: `Test runner failed: ${testResult.stderr || 'could not parse output'}`,
    };
  }

  // 2. If any tests fail, return fail immediately
  if (failedTests > 0) {
    return {
      name,
      status: 'fail',
      message: `${failedTests} tests failed out of ${totalTests}`,
    };
  }

  // 3. Run vitest with coverage and read coverage summary
  runCommand('npx', ['vitest', 'run', '--coverage', '--reporter=json'], gitiPath);

  let coveragePercent = 0;
  try {
    const coveragePath = path.join(gitiPath, 'coverage', 'coverage-summary.json');
    const coverageRaw = await fs.readFile(coveragePath, 'utf-8');
    const coverageData = JSON.parse(coverageRaw) as {
      total?: { statements?: { pct?: number } };
    };
    coveragePercent = coverageData.total?.statements?.pct ?? 0;
  } catch {
    // If coverage file can't be read, treat as 0
    coveragePercent = 0;
  }

  const floor = config.quality_standards.test_coverage_floor;

  // 4. If coverage below floor, fail
  if (coveragePercent < floor) {
    return {
      name,
      status: 'fail',
      message: `Coverage ${coveragePercent}% below floor ${floor}%`,
    };
  }

  // 5. If baselines exist and coverage decreased (but still above floor), warn
  if (baselines && coveragePercent < baselines.test_coverage) {
    return {
      name,
      status: 'warn',
      message: `Coverage decreased from ${baselines.test_coverage}% to ${coveragePercent}%`,
    };
  }

  // 6. All good
  const passedTests = totalTests - failedTests;
  return {
    name,
    status: 'pass',
    message: `${passedTests}/${totalTests} tests passing, coverage ${coveragePercent}%`,
  };
}
