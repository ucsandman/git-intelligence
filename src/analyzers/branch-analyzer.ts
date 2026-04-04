import type { SimpleGit } from 'simple-git';
import type { StaleBranch } from '../types/index.js';

const EXCLUDED_BRANCHES = new Set(['HEAD']);

async function getBranchLastCommitDate(
  git: SimpleGit,
  branchName: string,
): Promise<{ date: Date; author: string }> {
  const dateStr = await git.raw(['log', '-1', '--format=%aI', branchName]);
  const trimmed = dateStr.trim();

  // Get author separately
  const log = await git.log({ [branchName]: null, maxCount: 1 });
  const author = log.latest?.author_name ?? 'Unknown';

  return {
    date: new Date(trimmed),
    author,
  };
}

export async function getBranchStats(
  git: SimpleGit,
  staleDays: number = 30,
): Promise<{ active: number; stale: number }> {
  const branchData = await git.branch();
  const branches = branchData.all;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  let active = 0;
  let stale = 0;

  for (const branchName of branches) {
    const { date } = await getBranchLastCommitDate(git, branchName);
    if (date < cutoff) {
      stale++;
    } else {
      active++;
    }
  }

  return { active, stale };
}

export async function getStaleBranches(
  git: SimpleGit,
  mainBranch: string,
  staleDays: number = 30,
): Promise<StaleBranch[]> {
  const branchData = await git.branch();
  const branches = branchData.all;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  const staleBranches: StaleBranch[] = [];

  for (const branchName of branches) {
    if (branchName === mainBranch || EXCLUDED_BRANCHES.has(branchName)) {
      continue;
    }

    const { date, author } = await getBranchLastCommitDate(git, branchName);

    if (date >= cutoff) {
      continue;
    }

    const aheadStr = await git.raw([
      'rev-list',
      '--count',
      mainBranch + '..' + branchName,
    ]);
    const aheadOfMain = parseInt(aheadStr.trim(), 10) || 0;

    staleBranches.push({
      name: branchName,
      lastCommitDate: date,
      author,
      aheadOfMain,
      commitCount: aheadOfMain,
    });
  }

  staleBranches.sort(
    (a, b) => a.lastCommitDate.getTime() - b.lastCommitDate.getTime(),
  );

  return staleBranches;
}
