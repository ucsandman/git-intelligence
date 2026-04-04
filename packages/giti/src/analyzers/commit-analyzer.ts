import type { SimpleGit } from 'simple-git';
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx']);
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git']);

export async function getLastCommit(
  git: SimpleGit,
): Promise<{ date: Date; message: string; author: string }> {
  const log = await git.log({ maxCount: 1 });
  const commit = log.all[0]!;
  const message =
    commit.message.length > 60
      ? commit.message.slice(0, 60) + '...'
      : commit.message;

  return {
    date: new Date(commit.date),
    message,
    author: commit.author_name,
  };
}

export async function getWeeklyStats(
  git: SimpleGit,
): Promise<{ count: number; authorCount: number }> {
  const log = await git.log({ '--since': '7 days ago' });
  const authors = new Set(log.all.map((c) => c.author_name));

  return {
    count: log.all.length,
    authorCount: authors.size,
  };
}

export async function getAvgCommitSize(git: SimpleGit): Promise<number> {
  const log = await git.log({ '--since': '7 days ago', '--stat': null });
  const commits = log.all;

  if (commits.length === 0) return 0;

  let totalSize = 0;
  let countWithDiff = 0;

  for (const commit of commits) {
    const diff = (commit as unknown as { diff?: { insertions: number; deletions: number } }).diff;
    if (diff) {
      totalSize += diff.insertions + diff.deletions;
      countWithDiff++;
    }
  }

  if (countWithDiff === 0) return 0;

  return Math.round(totalSize / countWithDiff);
}

export async function getBusFactor(
  git: SimpleGit,
): Promise<{ count: number; topAuthorsPercentage: number; topAuthorCount: number }> {
  const log = await git.log({ '--since': '90 days ago' });
  const commits = log.all;

  if (commits.length === 0) {
    return { count: 0, topAuthorsPercentage: 0, topAuthorCount: 0 };
  }

  const authorCounts = new Map<string, number>();
  for (const commit of commits) {
    const count = authorCounts.get(commit.author_name) ?? 0;
    authorCounts.set(commit.author_name, count + 1);
  }

  const sorted = [...authorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const total = commits.length;
  const threshold = total * 0.5;

  let accumulated = 0;
  let topCount = 0;

  for (const [, count] of sorted) {
    accumulated += count;
    topCount++;
    if (accumulated >= threshold) break;
  }

  const topPercentage = Math.round((accumulated / total) * 100);

  return {
    count: topCount,
    topAuthorsPercentage: topPercentage,
    topAuthorCount: topCount,
  };
}

export async function getHottestFile(
  git: SimpleGit,
): Promise<{ path: string; changeCount: number } | null> {
  const raw = await git.raw([
    'log',
    '--since=7 days ago',
    '--name-only',
    '--pretty=format:',
  ]);

  const lines = raw.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) return null;

  const fileCounts = new Map<string, number>();
  for (const file of lines) {
    const trimmed = file.trim();
    const count = fileCounts.get(trimmed) ?? 0;
    fileCounts.set(trimmed, count + 1);
  }

  let hottestFile = '';
  let maxCount = 0;

  for (const [file, count] of fileCounts) {
    if (count > maxCount) {
      maxCount = count;
      hottestFile = file;
    }
  }

  return { path: hottestFile, changeCount: maxCount };
}

export async function getTestRatio(
  repoPath: string,
): Promise<{ testFiles: number; sourceFiles: number; percentage: number }> {
  let sourceFiles = 0;
  let testFiles = 0;

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!SOURCE_EXTENSIONS.has(ext)) continue;

        sourceFiles++;

        const isTest =
          entry.name.includes('.test.') ||
          entry.name.includes('.spec.') ||
          dir.includes('__tests__');

        if (isTest) {
          testFiles++;
        }
      }
    }
  }

  await walk(repoPath);

  return {
    testFiles,
    sourceFiles,
    percentage: sourceFiles > 0 ? Math.round((testFiles / sourceFiles) * 100) : 0,
  };
}
