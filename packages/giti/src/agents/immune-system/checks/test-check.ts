import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CheckResult } from '../types.js';
import type { Baselines } from '../types.js';
import type { OrganismConfig } from '../../types.js';
import { runCommand } from '../../utils.js';

async function runVitestToJsonFile(gitiPath: string): Promise<string> {
  // Write the JSON report to a temp file instead of parsing stdout — stdout
  // capture via execFileSync has been flaky on Windows, and a file round-trip
  // is bulletproof.
  const outputFile = path.join(
    os.tmpdir(),
    `giti-vitest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.json`,
  );
  try {
    runCommand(
      'npx',
      ['vitest', 'run', '--reporter=json', `--outputFile=${outputFile}`],
      gitiPath,
    );
    return await fs.readFile(outputFile, 'utf-8').catch(() => '');
  } finally {
    await fs.unlink(outputFile).catch(() => {});
  }
}

function countFailures(stdout: string): { total: number; failed: number; failedNames: string[] } {
  try {
    const parsed = JSON.parse(stdout) as {
      numTotalTests?: number;
      numFailedTests?: number;
      testResults?: Array<{
        assertionResults?: Array<{ status?: string; fullName?: string }>;
      }>;
    };
    const failedNames: string[] = [];
    for (const suite of parsed.testResults ?? []) {
      for (const test of suite.assertionResults ?? []) {
        if (test.status === 'failed' && test.fullName) {
          failedNames.push(test.fullName);
        }
      }
    }
    return {
      total: parsed.numTotalTests ?? 0,
      failed: parsed.numFailedTests ?? 0,
      failedNames,
    };
  } catch {
    return { total: 0, failed: -1, failedNames: [] };
  }
}

export async function runTestCheck(
  repoPath: string,
  baselines: Baselines | null,
  config: OrganismConfig,
): Promise<CheckResult> {
  const name = 'Tests';
  const gitiPath = path.join(repoPath, 'packages', 'giti');

  // 1. Run tests on the current branch
  const branchJson = await runVitestToJsonFile(gitiPath);
  const branch = countFailures(branchJson);

  if (branch.failed === -1) {
    const preview = branchJson.slice(0, 300).replace(/\s+/g, ' ');
    return {
      name,
      status: 'fail',
      message: `Test runner failed: could not parse output (got ${branchJson.length} bytes; preview: ${preview || '<empty>'})`,
    };
  }

  // 2. Run tests on main to get baseline failures
  const currentBranch = runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repoPath).stdout.trim();
  runCommand('git', ['stash', '--include-untracked'], repoPath);
  runCommand('git', ['checkout', 'main'], repoPath);
  const mainJson = await runVitestToJsonFile(gitiPath);
  const main = countFailures(mainJson);
  runCommand('git', ['checkout', currentBranch], repoPath);
  runCommand('git', ['stash', 'pop'], repoPath);

  // 3. Compare: only reject if branch introduces NEW failures
  const newFailures = branch.failedNames.filter((f) => !main.failedNames.includes(f));

  if (newFailures.length > 0) {
    return {
      name,
      status: 'fail',
      message: `${newFailures.length} NEW test failures introduced (${branch.failed} total, ${main.failed} pre-existing): ${newFailures.slice(0, 3).join(', ')}`,
    };
  }

  // Pre-existing failures are fine — warn but don't block
  if (branch.failed > 0 && branch.failed <= main.failed) {
    // Not worse than main — pass with note
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
  const passedTests = branch.total - branch.failed;
  return {
    name,
    status: 'pass',
    message: `${passedTests}/${branch.total} tests passing${branch.failed > 0 ? ` (${branch.failed} pre-existing failures)` : ''}, coverage ${coveragePercent}%`,
  };
}
