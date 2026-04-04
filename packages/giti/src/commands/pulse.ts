import { createGitClient, getRepoName, validateGitRepo } from '../utils/git.js';
import {
  getLastCommit,
  getWeeklyStats,
  getAvgCommitSize,
  getBusFactor,
  getHottestFile,
  getTestRatio,
} from '../analyzers/commit-analyzer.js';
import { getBranchStats } from '../analyzers/branch-analyzer.js';
import { formatPulse } from '../formatters/terminal.js';
import type { PulseResult } from '../types/index.js';
import ora from 'ora';

export async function executePulse(options: {
  path?: string;
  json?: boolean;
}): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  try {
    await validateGitRepo(repoPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(message);
    process.exit(1);
  }

  const spinner = options.json ? null : ora('Analyzing repository...').start();

  const git = createGitClient(repoPath);

  const [lastCommit, weeklyCommits, avgCommitSize, busFactor, hottestFile, testRatio, branches] =
    await Promise.all([
      getLastCommit(git),
      getWeeklyStats(git),
      getAvgCommitSize(git),
      getBusFactor(git),
      getHottestFile(git),
      getTestRatio(repoPath),
      getBranchStats(git),
    ]);

  const result: PulseResult = {
    repoName: getRepoName(repoPath),
    lastCommit,
    weeklyCommits,
    branches,
    hottestFile,
    testRatio,
    avgCommitSize,
    busFactor,
  };

  spinner?.stop();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatPulse(result));
  }
}
