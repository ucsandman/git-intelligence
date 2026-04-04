import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mock return values so they're available in vi.mock factories
const {
  mockValidateGitRepo,
  mockCreateGitClient,
  mockGetMainBranch,
  mockGetStaleBranches,
  mockGetDeadCodeSignals,
  mockFormatGhosts,
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
    mockCreateGitClient: vi.fn().mockReturnValue({
      branch: vi.fn().mockResolvedValue({
        all: ['main', 'feature-old', 'feature-dead'],
        current: 'main',
      }),
    }),
    mockGetMainBranch: vi.fn().mockReturnValue('main'),
    mockGetStaleBranches: vi.fn().mockResolvedValue([
      {
        name: 'feature-old',
        lastCommitDate: new Date('2025-12-01T00:00:00Z'),
        author: 'Alice',
        aheadOfMain: 3,
        commitCount: 3,
      },
    ]),
    mockGetDeadCodeSignals: vi.fn().mockResolvedValue([
      {
        filepath: 'src/legacy.ts',
        lastModified: new Date('2025-06-15T00:00:00Z'),
        importedByCount: 0,
      },
    ]),
    mockFormatGhosts: vi.fn().mockReturnValue('formatted-ghosts-output'),
    mockOraInstance: oraInstance,
  };
});

vi.mock('../../src/utils/git.js', () => ({
  validateGitRepo: mockValidateGitRepo,
  createGitClient: mockCreateGitClient,
  getMainBranch: mockGetMainBranch,
  getRepoName: vi.fn().mockReturnValue('my-repo'),
}));

vi.mock('../../src/analyzers/branch-analyzer.js', () => ({
  getStaleBranches: mockGetStaleBranches,
}));

vi.mock('../../src/analyzers/code-analyzer.js', () => ({
  getDeadCodeSignals: mockGetDeadCodeSignals,
}));

vi.mock('../../src/formatters/terminal.js', () => ({
  formatGhosts: mockFormatGhosts,
}));

vi.mock('ora', () => ({
  default: vi.fn().mockReturnValue(mockOraInstance),
}));

import { executeGhosts } from '../../src/commands/ghosts.js';

describe('executeGhosts', () => {
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

  it('calls analyzers with default parameters (staleDays=30, deadMonths=6)', async () => {
    const fakeBranchFn = vi.fn().mockResolvedValue({
      all: ['main', 'feature-old'],
      current: 'main',
    });
    const fakeGit = { branch: fakeBranchFn };
    mockCreateGitClient.mockReturnValue(fakeGit);
    mockGetMainBranch.mockReturnValue('main');

    await executeGhosts({ path: '/test-repo' });

    expect(mockValidateGitRepo).toHaveBeenCalledWith('/test-repo');
    expect(mockCreateGitClient).toHaveBeenCalledWith('/test-repo');
    expect(fakeBranchFn).toHaveBeenCalled();
    expect(mockGetMainBranch).toHaveBeenCalledWith(['main', 'feature-old']);
    expect(mockGetStaleBranches).toHaveBeenCalledWith(fakeGit, 'main', 30);
    expect(mockGetDeadCodeSignals).toHaveBeenCalledWith(fakeGit, '/test-repo', 6);
  });

  it('passes custom --stale-days and --dead-months', async () => {
    const fakeBranchFn = vi.fn().mockResolvedValue({
      all: ['main', 'feature-old'],
      current: 'main',
    });
    const fakeGit = { branch: fakeBranchFn };
    mockCreateGitClient.mockReturnValue(fakeGit);
    mockGetMainBranch.mockReturnValue('main');

    await executeGhosts({ path: '/test-repo', staleDays: 60, deadMonths: 12 });

    expect(mockGetStaleBranches).toHaveBeenCalledWith(fakeGit, 'main', 60);
    expect(mockGetDeadCodeSignals).toHaveBeenCalledWith(fakeGit, '/test-repo', 12);
  });

  it('outputs valid JSON with staleBranches and deadCode arrays', async () => {
    await executeGhosts({ path: '/test-repo', json: true });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.staleBranches).toEqual([
      {
        name: 'feature-old',
        lastCommitDate: '2025-12-01T00:00:00.000Z',
        author: 'Alice',
        aheadOfMain: 3,
        commitCount: 3,
      },
    ]);
    expect(parsed.deadCode).toEqual([
      {
        filepath: 'src/legacy.ts',
        lastModified: '2025-06-15T00:00:00.000Z',
        importedByCount: 0,
      },
    ]);
  });

  it('calls formatGhosts with the mainBranch in formatted mode', async () => {
    const fakeBranchFn = vi.fn().mockResolvedValue({
      all: ['master', 'feature-old'],
      current: 'master',
    });
    const fakeGit = { branch: fakeBranchFn };
    mockCreateGitClient.mockReturnValue(fakeGit);
    mockGetMainBranch.mockReturnValue('master');

    await executeGhosts({ path: '/test-repo' });

    expect(mockFormatGhosts).toHaveBeenCalledTimes(1);
    const [resultArg, mainBranchArg] = mockFormatGhosts.mock.calls[0]!;
    expect(resultArg.staleBranches).toHaveLength(1);
    expect(resultArg.deadCode).toHaveLength(1);
    expect(mainBranchArg).toBe('master');

    expect(consoleSpy).toHaveBeenCalledWith('formatted-ghosts-output');
  });

  it('prints error and exits for non-git directory', async () => {
    mockValidateGitRepo.mockRejectedValueOnce(new Error('Not a git repository: /bad-path'));

    await executeGhosts({ path: '/bad-path' });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorMsg = consoleErrorSpy.mock.calls[0]![0] as string;
    expect(errorMsg).toContain('Not a git repository');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('correctly determines main branch from git.branch()', async () => {
    const fakeBranchFn = vi.fn().mockResolvedValue({
      all: ['develop', 'master', 'feature-x'],
      current: 'develop',
    });
    const fakeGit = { branch: fakeBranchFn };
    mockCreateGitClient.mockReturnValue(fakeGit);
    mockGetMainBranch.mockReturnValue('master');

    await executeGhosts({ path: '/test-repo' });

    expect(mockGetMainBranch).toHaveBeenCalledWith(['develop', 'master', 'feature-x']);
    expect(mockGetStaleBranches).toHaveBeenCalledWith(fakeGit, 'master', 30);
  });

  it('does not show spinner in JSON mode', async () => {
    await executeGhosts({ path: '/test-repo', json: true });

    expect(mockOraInstance.start).not.toHaveBeenCalled();
  });

  it('shows and stops spinner in formatted mode', async () => {
    await executeGhosts({ path: '/test-repo' });

    expect(mockOraInstance.start).toHaveBeenCalled();
    expect(mockOraInstance.stop).toHaveBeenCalled();
  });

  it('uses process.cwd() when no path is provided', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/default-cwd');

    await executeGhosts({});

    expect(mockValidateGitRepo).toHaveBeenCalledWith('/default-cwd');
    expect(mockCreateGitClient).toHaveBeenCalledWith('/default-cwd');

    cwdSpy.mockRestore();
  });
});
