import { createGitClient, getMainBranch, validateGitRepo } from '../utils/git.js';
import { getStaleBranches } from '../analyzers/branch-analyzer.js';
import { getDeadCodeSignals } from '../analyzers/code-analyzer.js';
import { formatGhosts } from '../formatters/terminal.js';
import type { GhostsResult } from '../types/index.js';
import ora from 'ora';

export async function executeGhosts(options: {
  path?: string;
  json?: boolean;
  staleDays?: number;
  deadMonths?: number;
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

  const spinner = options.json ? null : ora('Detecting abandoned work...').start();

  const git = createGitClient(repoPath);

  const branchData = await git.branch();
  const mainBranch = getMainBranch(branchData.all);

  const [staleBranches, deadCode] = await Promise.all([
    getStaleBranches(git, mainBranch, options.staleDays ?? 30),
    getDeadCodeSignals(git, repoPath, options.deadMonths ?? 6),
  ]);

  const result: GhostsResult = {
    staleBranches,
    deadCode,
  };

  spinner?.stop();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatGhosts(result, mainBranch));
  }
}
