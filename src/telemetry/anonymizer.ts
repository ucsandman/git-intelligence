import type { SimpleGit } from 'simple-git';
import type { RepoCharacteristics } from './types.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export function bucketCommitCount(count: number): string {
  if (count <= 100) return '0-100';
  if (count <= 1000) return '100-1k';
  if (count <= 10000) return '1k-10k';
  if (count <= 100000) return '10k-100k';
  return '100k+';
}

export function bucketBranchCount(count: number): string {
  if (count <= 5) return '0-5';
  if (count <= 20) return '5-20';
  if (count <= 50) return '20-50';
  return '50+';
}

export function bucketAuthorCount(count: number): string {
  if (count <= 1) return '1';
  if (count <= 5) return '2-5';
  if (count <= 20) return '5-20';
  return '20+';
}

export function bucketRepoAge(firstCommitDate: Date): string {
  const months = (Date.now() - firstCommitDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
  if (months < 1) return '<1mo';
  if (months < 6) return '1-6mo';
  if (months < 24) return '6mo-2y';
  return '2y+';
}

export function detectPrimaryLanguage(fileExtensions: Record<string, number>): string {
  const langMap: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.go': 'Go', '.rs': 'Rust',
    '.rb': 'Ruby', '.java': 'Java', '.c': 'C',
    '.cpp': 'C++', '.cs': 'C#', '.php': 'PHP',
    '.swift': 'Swift', '.kt': 'Kotlin',
  };
  let maxCount = 0;
  let primary = 'Unknown';
  for (const [ext, count] of Object.entries(fileExtensions)) {
    const lang = langMap[ext];
    if (lang && count > maxCount) {
      maxCount = count;
      primary = lang;
    }
  }
  return primary;
}

export async function detectMonorepo(repoPath: string): Promise<boolean> {
  try {
    // Check for packages/ directory
    try {
      await fs.access(path.join(repoPath, 'packages'));
      return true;
    } catch { /* not found */ }

    // Check for apps/ directory
    try {
      await fs.access(path.join(repoPath, 'apps'));
      return true;
    } catch { /* not found */ }

    // Check for lerna.json
    try {
      await fs.access(path.join(repoPath, 'lerna.json'));
      return true;
    } catch { /* not found */ }

    // Check for pnpm-workspace.yaml
    try {
      await fs.access(path.join(repoPath, 'pnpm-workspace.yaml'));
      return true;
    } catch { /* not found */ }

    // Check for workspaces in package.json
    try {
      const pkgContent = await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgContent) as { workspaces?: unknown };
      if (pkg.workspaces) return true;
    } catch { /* not found or invalid */ }

    return false;
  } catch {
    return false;
  }
}

export async function buildRepoCharacteristics(git: SimpleGit, repoPath: string): Promise<RepoCharacteristics> {
  try {
    // Get commit count
    const log = await git.log();
    const commitCount = log.total;

    // Get branch count
    const branches = await git.branch();
    const branchCount = branches.all.length;

    // Get unique authors (from last 100 commits to keep it fast)
    const recentLog = await git.log({ maxCount: 100 });
    const authors = new Set(recentLog.all.map(c => c.author_name));

    // Get first commit date for age bucket
    const firstCommitRaw = await git.raw(['log', '--reverse', '--format=%aI', '-1']);
    const firstCommitDate = firstCommitRaw.trim() ? new Date(firstCommitRaw.trim()) : new Date();

    // Scan for file extensions (quick scan of tracked files)
    const trackedFiles = await git.raw(['ls-files']);
    const extCounts: Record<string, number> = {};
    for (const file of trackedFiles.split('\n').filter(Boolean)) {
      const ext = path.extname(file);
      if (ext) extCounts[ext] = (extCounts[ext] ?? 0) + 1;
    }

    const isMonorepo = await detectMonorepo(repoPath);

    return {
      commit_count_bucket: bucketCommitCount(commitCount),
      branch_count_bucket: bucketBranchCount(branchCount),
      author_count_bucket: bucketAuthorCount(authors.size),
      primary_language: detectPrimaryLanguage(extCounts),
      has_monorepo_structure: isMonorepo,
      age_bucket: bucketRepoAge(firstCommitDate),
    };
  } catch {
    // If anything fails, return safe defaults
    return {
      commit_count_bucket: '0-100',
      branch_count_bucket: '0-5',
      author_count_bucket: '1',
      primary_language: 'Unknown',
      has_monorepo_structure: false,
      age_bucket: '<1mo',
    };
  }
}
