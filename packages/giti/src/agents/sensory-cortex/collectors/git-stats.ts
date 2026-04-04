import type { SimpleGit } from 'simple-git';
import type { StateReport } from '../types.js';

const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function collectGitStats(git: SimpleGit): Promise<StateReport['git']> {
  const [totalLog, log7d, log30d, statLog, branchSummary] = await Promise.all([
    git.log(),
    git.log({ '--since': '7 days ago' }),
    git.log({ '--since': '30 days ago' }),
    git.log({ '--since': '7 days ago', '--stat': null }),
    git.branch(),
  ]);

  // Unique authors from 30d window
  const authors = new Set(log30d.all.map((c) => c.author_name));

  // Branch staleness
  const branchNames = branchSummary.all;
  let staleBranches = 0;
  let activeBranches = 0;

  if (branchNames.length > 0) {
    const branchDates = await Promise.all(
      branchNames.map((name) =>
        git.raw(['log', '-1', '--format=%aI', name]).then((d) => d.trim()),
      ),
    );

    const now = Date.now();
    for (const dateStr of branchDates) {
      if (!dateStr) continue;
      const age = now - new Date(dateStr).getTime();
      if (age > STALE_THRESHOLD_MS) {
        staleBranches++;
      } else {
        activeBranches++;
      }
    }
  }

  // Last commit age
  let lastCommitAgeHours = 0;
  const latestCommit = totalLog.latest;
  if (latestCommit) {
    lastCommitAgeHours = (Date.now() - new Date(latestCommit.date).getTime()) / (1000 * 60 * 60);
  }

  // Average commit size from 7d stat log
  let avgCommitSize = 0;
  const statCommits = statLog.all;
  if (statCommits.length > 0) {
    let totalLines = 0;
    for (const commit of statCommits) {
      const diff = (commit as unknown as { diff?: { insertions: number; deletions: number } }).diff;
      if (diff) {
        totalLines += diff.insertions + diff.deletions;
      }
    }
    avgCommitSize = totalLines / statCommits.length;
  }

  return {
    total_commits: totalLog.total,
    commits_last_7d: log7d.total,
    commits_last_30d: log30d.total,
    unique_authors_30d: authors.size,
    active_branches: activeBranches,
    stale_branches: staleBranches,
    last_commit_age_hours: lastCommitAgeHours,
    avg_commit_size_lines: avgCommitSize,
  };
}
