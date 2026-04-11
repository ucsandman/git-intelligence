import { createGitClient, getRepoName, getMainBranch } from '../../utils/git.js';
import {
  getLastCommit,
  getWeeklyStats,
  getAvgCommitSize,
  getBusFactor,
  getHottestFile,
  getTestRatio,
} from '../../analyzers/commit-analyzer.js';
import { getBranchStats, getStaleBranches } from '../../analyzers/branch-analyzer.js';
import { getHotspots, getFileCouplings } from '../../analyzers/file-analyzer.js';
import { getDeadCodeSignals } from '../../analyzers/code-analyzer.js';
import type { PulseResult, HotspotsResult, GhostsResult } from '../../types/index.js';
import type { FieldTarget, FieldObservation } from './types.js';

export interface RunnerOptions {
  perAnalyzerTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Run analyzers against a target repo path and return an observation.
 * Never writes to the target repo.
 *
 * Does NOT derive mood or narrative — those come from the narrator.
 * This function only returns raw signal data.
 */
export async function runFieldObservation(
  target: FieldTarget,
  options: RunnerOptions = {},
): Promise<Omit<FieldObservation, 'narrative' | 'mood' | 'observedAt' | 'cycle'>> {
  const timeout = options.perAnalyzerTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const errors: string[] = [];

  const pulse = await withTimeout(collectPulse(target.path), timeout, 'pulse', errors);
  const hotspots = await withTimeout(collectHotspots(target.path), timeout, 'hotspots', errors);
  const ghosts = await withTimeout(collectGhosts(target.path), timeout, 'ghosts', errors);

  return {
    target: target.slug,
    targetPath: target.path,
    pulse: pulse ?? emptyPulse(target.path),
    hotspots: hotspots ?? emptyHotspots(),
    ghosts: ghosts ?? emptyGhosts(),
    partial: errors.length > 0,
    errors,
  };
}

async function collectPulse(repoPath: string): Promise<PulseResult> {
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
  return {
    repoName: getRepoName(repoPath),
    lastCommit,
    weeklyCommits,
    branches,
    hottestFile,
    testRatio,
    avgCommitSize,
    busFactor,
  };
}

async function collectHotspots(repoPath: string): Promise<HotspotsResult> {
  const git = createGitClient(repoPath);
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [hotspots, couplings] = await Promise.all([
    getHotspots(git, sinceDate, 10),
    getFileCouplings(git, sinceDate),
  ]);
  return { period: '30d', hotspots, couplings };
}

async function collectGhosts(repoPath: string): Promise<GhostsResult> {
  const git = createGitClient(repoPath);
  const branchData = await git.branch();
  const mainBranch = getMainBranch(branchData.all);
  const [staleBranches, deadCode] = await Promise.all([
    getStaleBranches(git, mainBranch, 30),
    getDeadCodeSignals(git, repoPath, 6),
  ]);
  return { staleBranches, deadCode };
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  errors: string[],
): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function emptyPulse(repoPath: string): PulseResult {
  return {
    repoName: repoPath,
    lastCommit: { date: new Date(0), message: '(unavailable)', author: '(unavailable)' },
    weeklyCommits: { count: 0, authorCount: 0 },
    branches: { active: 0, stale: 0 },
    hottestFile: null,
    testRatio: { testFiles: 0, sourceFiles: 0, percentage: 0 },
    avgCommitSize: 0,
    busFactor: { count: 0, topAuthorsPercentage: 0, topAuthorCount: 0 },
  };
}

function emptyHotspots(): HotspotsResult {
  return { period: '30d', hotspots: [], couplings: [] };
}

function emptyGhosts(): GhostsResult {
  return { staleBranches: [], deadCode: [] };
}
