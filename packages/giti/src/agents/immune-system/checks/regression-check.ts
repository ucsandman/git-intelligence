import simpleGit from 'simple-git';
import type { CheckResult } from '../types.js';
import type { RegressionContext } from '../types.js';

export async function runRegressionCheck(
  repoPath: string,
  branch: string,
  regressionContext: RegressionContext | null,
): Promise<CheckResult> {
  const name = 'Regression';

  // 1. If no regression context, nothing to check
  if (!regressionContext || regressionContext.fragile_files.length === 0) {
    return {
      name,
      status: 'pass',
      message: 'No regression history available',
    };
  }

  // 2. Get changed files
  const git = simpleGit(repoPath);
  let changedFilesRaw: string;
  try {
    changedFilesRaw = await git.diff(['main...' + branch, '--name-only']);
  } catch {
    return {
      name,
      status: 'pass',
      message: 'Could not compute diff (branch may not exist yet)',
    };
  }

  const changedFiles = changedFilesRaw
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  if (changedFiles.length === 0) {
    return {
      name,
      status: 'pass',
      message: 'No changed files to check',
    };
  }

  // 3. Check changed files against fragile_files
  const highRisk: string[] = [];
  const fragile: string[] = [];

  for (const file of changedFiles) {
    const entry = regressionContext.fragile_files.find((f) => f.path === file);
    if (!entry) continue;

    if (entry.regression_count >= 3) {
      highRisk.push(
        `High-risk file modified: ${file} (${entry.regression_count} previous regressions)`,
      );
    } else if (entry.regression_count >= 1) {
      fragile.push(
        `Fragile file modified: ${file} (${entry.regression_count} previous regressions)`,
      );
    }
  }

  // 4. Return result based on severity
  if (highRisk.length > 0) {
    return {
      name,
      status: 'fail',
      message: highRisk[0]!,
      details: { high_risk: highRisk, fragile },
    };
  }

  if (fragile.length > 0) {
    return {
      name,
      status: 'warn',
      message: fragile[0]!,
      details: { fragile },
    };
  }

  return {
    name,
    status: 'pass',
    message: 'No known fragile files touched',
  };
}
