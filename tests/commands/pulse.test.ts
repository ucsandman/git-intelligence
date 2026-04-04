import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mock return values so they're available in vi.mock factories
const {
  mockValidateGitRepo,
  mockCreateGitClient,
  mockGetRepoName,
  mockGetLastCommit,
  mockGetWeeklyStats,
  mockGetAvgCommitSize,
  mockGetBusFactor,
  mockGetHottestFile,
  mockGetTestRatio,
  mockGetBranchStats,
  mockFormatPulse,
  mockOraInstance,
} = vi.hoisted(() => {
  const oraInstance = {
    start: vi.fn(),
    stop: vi.fn(),
    fail: vi.fn(),
  };
  oraInstance.start.mockReturnValue(oraInstance);

  return {
    mockValidateGitRepo: vi.fn().mockResolvedValue(undefined),
    mockCreateGitClient: vi.fn().mockReturnValue({}),
    mockGetRepoName: vi.fn().mockReturnValue('my-repo'),
    mockGetLastCommit: vi.fn().mockResolvedValue({
      date: new Date('2026-04-03T10:00:00Z'),
      message: 'fix: auth',
      author: 'Alice',
    }),
    mockGetWeeklyStats: vi.fn().mockResolvedValue({ count: 23, authorCount: 3 }),
    mockGetAvgCommitSize: vi.fn().mockResolvedValue(42),
    mockGetBusFactor: vi.fn().mockResolvedValue({
      count: 2,
      topAuthorsPercentage: 73,
      topAuthorCount: 2,
    }),
    mockGetHottestFile: vi.fn().mockResolvedValue({
      path: 'src/auth.ts',
      changeCount: 8,
    }),
    mockGetTestRatio: vi.fn().mockResolvedValue({
      testFiles: 10,
      sourceFiles: 15,
      percentage: 67,
    }),
    mockGetBranchStats: vi.fn().mockResolvedValue({ active: 4, stale: 2 }),
    mockFormatPulse: vi.fn().mockReturnValue('formatted-pulse-output'),
    mockOraInstance: oraInstance,
  };
});

vi.mock('../../src/utils/git.js', () => ({
  validateGitRepo: mockValidateGitRepo,
  createGitClient: mockCreateGitClient,
  getRepoName: mockGetRepoName,
}));

vi.mock('../../src/analyzers/commit-analyzer.js', () => ({
  getLastCommit: mockGetLastCommit,
  getWeeklyStats: mockGetWeeklyStats,
  getAvgCommitSize: mockGetAvgCommitSize,
  getBusFactor: mockGetBusFactor,
  getHottestFile: mockGetHottestFile,
  getTestRatio: mockGetTestRatio,
}));

vi.mock('../../src/analyzers/branch-analyzer.js', () => ({
  getBranchStats: mockGetBranchStats,
}));

vi.mock('../../src/formatters/terminal.js', () => ({
  formatPulse: mockFormatPulse,
}));

vi.mock('ora', () => ({
  default: vi.fn().mockReturnValue(mockOraInstance),
}));

import { executePulse } from '../../src/commands/pulse.js';

describe('executePulse', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('calls all analyzers with the git client', async () => {
    const fakeGit = { fake: true };
    mockCreateGitClient.mockReturnValue(fakeGit);

    await executePulse({ path: '/test-repo' });

    expect(mockValidateGitRepo).toHaveBeenCalledWith('/test-repo');
    expect(mockCreateGitClient).toHaveBeenCalledWith('/test-repo');
    expect(mockGetLastCommit).toHaveBeenCalledWith(fakeGit);
    expect(mockGetWeeklyStats).toHaveBeenCalledWith(fakeGit);
    expect(mockGetAvgCommitSize).toHaveBeenCalledWith(fakeGit);
    expect(mockGetBusFactor).toHaveBeenCalledWith(fakeGit);
    expect(mockGetHottestFile).toHaveBeenCalledWith(fakeGit);
    expect(mockGetTestRatio).toHaveBeenCalledWith('/test-repo');
    expect(mockGetBranchStats).toHaveBeenCalledWith(fakeGit);
    expect(mockGetRepoName).toHaveBeenCalledWith('/test-repo');
  });

  it('outputs valid JSON with all fields in JSON mode', async () => {
    await executePulse({ path: '/test-repo', json: true });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.repoName).toBe('my-repo');
    expect(parsed.lastCommit.message).toBe('fix: auth');
    expect(parsed.lastCommit.author).toBe('Alice');
    expect(parsed.lastCommit.date).toBe('2026-04-03T10:00:00.000Z');
    expect(parsed.weeklyCommits).toEqual({ count: 23, authorCount: 3 });
    expect(parsed.branches).toEqual({ active: 4, stale: 2 });
    expect(parsed.hottestFile).toEqual({ path: 'src/auth.ts', changeCount: 8 });
    expect(parsed.testRatio).toEqual({ testFiles: 10, sourceFiles: 15, percentage: 67 });
    expect(parsed.avgCommitSize).toBe(42);
    expect(parsed.busFactor).toEqual({ count: 2, topAuthorsPercentage: 73, topAuthorCount: 2 });
  });

  it('calls formatPulse and prints the result in formatted mode', async () => {
    await executePulse({ path: '/test-repo' });

    expect(mockFormatPulse).toHaveBeenCalledTimes(1);
    const pulseArg = mockFormatPulse.mock.calls[0]![0];
    expect(pulseArg.repoName).toBe('my-repo');
    expect(pulseArg.lastCommit.author).toBe('Alice');

    expect(consoleSpy).toHaveBeenCalledWith('formatted-pulse-output');
  });

  it('does not show spinner in JSON mode', async () => {
    await executePulse({ path: '/test-repo', json: true });

    expect(mockOraInstance.start).not.toHaveBeenCalled();
  });

  it('shows and stops spinner in formatted mode', async () => {
    await executePulse({ path: '/test-repo' });

    expect(mockOraInstance.start).toHaveBeenCalled();
    expect(mockOraInstance.stop).toHaveBeenCalled();
  });

  it('prints error and exits for non-git directory', async () => {
    mockValidateGitRepo.mockRejectedValueOnce(new Error('Not a git repository: /bad-path'));

    await executePulse({ path: '/bad-path' });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorMsg = consoleErrorSpy.mock.calls[0]![0] as string;
    expect(errorMsg).toContain('Not a git repository');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('uses process.cwd() when no path is provided', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/default-cwd');

    await executePulse({});

    expect(mockValidateGitRepo).toHaveBeenCalledWith('/default-cwd');
    expect(mockCreateGitClient).toHaveBeenCalledWith('/default-cwd');

    cwdSpy.mockRestore();
  });
});
