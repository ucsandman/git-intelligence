import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mock return values so they're available in vi.mock factories
const {
  mockValidateGitRepo,
  mockCreateGitClient,
  mockParsePeriod,
  mockGetHotspots,
  mockGetFileCouplings,
  mockFormatHotspots,
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
    mockParsePeriod: vi.fn().mockReturnValue(new Date('2026-03-05T00:00:00Z')),
    mockGetHotspots: vi.fn().mockResolvedValue([
      { filepath: 'src/auth.ts', changes: 15, authors: 3, bugFixes: 4 },
      { filepath: 'src/api.ts', changes: 10, authors: 2, bugFixes: 1 },
    ]),
    mockGetFileCouplings: vi.fn().mockResolvedValue([
      { fileA: 'src/auth.ts', fileB: 'src/session.ts', percentage: 85, coOccurrences: 12 },
    ]),
    mockFormatHotspots: vi.fn().mockReturnValue('formatted-hotspots-output'),
    mockOraInstance: oraInstance,
  };
});

vi.mock('../../src/utils/git.js', () => ({
  validateGitRepo: mockValidateGitRepo,
  createGitClient: mockCreateGitClient,
  parsePeriod: mockParsePeriod,
}));

vi.mock('../../src/analyzers/file-analyzer.js', () => ({
  getHotspots: mockGetHotspots,
  getFileCouplings: mockGetFileCouplings,
}));

vi.mock('../../src/formatters/terminal.js', () => ({
  formatHotspots: mockFormatHotspots,
}));

vi.mock('ora', () => ({
  default: vi.fn().mockReturnValue(mockOraInstance),
}));

import { executeHotspots } from '../../src/commands/hotspots.js';

describe('executeHotspots', () => {
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

  it('calls analyzers with default since (30d) and top (10)', async () => {
    const fakeGit = { fake: true };
    mockCreateGitClient.mockReturnValue(fakeGit);
    const sinceDate = new Date('2026-03-05T00:00:00Z');
    mockParsePeriod.mockReturnValue(sinceDate);

    await executeHotspots({ path: '/test-repo' });

    expect(mockValidateGitRepo).toHaveBeenCalledWith('/test-repo');
    expect(mockCreateGitClient).toHaveBeenCalledWith('/test-repo');
    expect(mockParsePeriod).toHaveBeenCalledWith('30d');
    expect(mockGetHotspots).toHaveBeenCalledWith(fakeGit, sinceDate, 10);
    expect(mockGetFileCouplings).toHaveBeenCalledWith(fakeGit, sinceDate);
  });

  it('passes custom --since and --top values', async () => {
    const fakeGit = { fake: true };
    mockCreateGitClient.mockReturnValue(fakeGit);
    const sinceDate = new Date('2025-04-04T00:00:00Z');
    mockParsePeriod.mockReturnValue(sinceDate);

    await executeHotspots({ path: '/test-repo', since: '1y', top: 20 });

    expect(mockParsePeriod).toHaveBeenCalledWith('1y');
    expect(mockGetHotspots).toHaveBeenCalledWith(fakeGit, sinceDate, 20);
    expect(mockGetFileCouplings).toHaveBeenCalledWith(fakeGit, sinceDate);
  });

  it('outputs valid JSON with period, hotspots, and couplings', async () => {
    await executeHotspots({ path: '/test-repo', json: true });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.period).toBe('30d');
    expect(parsed.hotspots).toEqual([
      { filepath: 'src/auth.ts', changes: 15, authors: 3, bugFixes: 4 },
      { filepath: 'src/api.ts', changes: 10, authors: 2, bugFixes: 1 },
    ]);
    expect(parsed.couplings).toEqual([
      { fileA: 'src/auth.ts', fileB: 'src/session.ts', percentage: 85, coOccurrences: 12 },
    ]);
  });

  it('calls formatHotspots and prints the result in formatted mode', async () => {
    await executeHotspots({ path: '/test-repo' });

    expect(mockFormatHotspots).toHaveBeenCalledTimes(1);
    const arg = mockFormatHotspots.mock.calls[0]![0];
    expect(arg.period).toBe('30d');
    expect(arg.hotspots).toHaveLength(2);
    expect(arg.couplings).toHaveLength(1);

    expect(consoleSpy).toHaveBeenCalledWith('formatted-hotspots-output');
  });

  it('prints error and exits for non-git directory', async () => {
    mockValidateGitRepo.mockRejectedValueOnce(new Error('Not a git repository: /bad-path'));

    await executeHotspots({ path: '/bad-path' });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorMsg = consoleErrorSpy.mock.calls[0]![0] as string;
    expect(errorMsg).toContain('Not a git repository');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not show spinner in JSON mode', async () => {
    await executeHotspots({ path: '/test-repo', json: true });

    expect(mockOraInstance.start).not.toHaveBeenCalled();
  });

  it('shows and stops spinner in formatted mode', async () => {
    await executeHotspots({ path: '/test-repo' });

    expect(mockOraInstance.start).toHaveBeenCalled();
    expect(mockOraInstance.stop).toHaveBeenCalled();
  });

  it('uses process.cwd() when no path is provided', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/default-cwd');

    await executeHotspots({});

    expect(mockValidateGitRepo).toHaveBeenCalledWith('/default-cwd');
    expect(mockCreateGitClient).toHaveBeenCalledWith('/default-cwd');

    cwdSpy.mockRestore();
  });
});
