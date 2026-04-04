/// <reference types="node" />
import simpleGit from 'simple-git';
import path from 'node:path';

export function createGitClient(repoPath?: string) {
  const targetPath = repoPath ?? process.cwd();
  return simpleGit(targetPath);
}

export function getRepoName(repoPath: string): string {
  return path.basename(repoPath);
}

export function getMainBranch(branches: string[]): string {
  if (branches.includes('main')) return 'main';
  if (branches.includes('master')) return 'master';
  return branches[0] ?? 'main';
}

export async function validateGitRepo(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }
}

export function parsePeriod(period: string): Date {
  const match = period.match(/^(\d+)(d|w|m|y)$/);
  if (!match) throw new Error(`Invalid period format: ${period}. Use format like 7d, 30d, 90d, 1y`);
  const [, valueStr, unit] = match;
  const value = parseInt(valueStr!, 10);
  const now = new Date();
  switch (unit) {
    case 'd': now.setDate(now.getDate() - value); break;
    case 'w': now.setDate(now.getDate() - value * 7); break;
    case 'm': now.setMonth(now.getMonth() - value); break;
    case 'y': now.setFullYear(now.getFullYear() - value); break;
  }
  return now;
}
