/// <reference types="node" />
import type { SimpleGit, LogResult, BranchSummary, BranchSummaryBranch } from 'simple-git';
import path from 'node:path';

// ── git-stats mocks ──────────────────────────────────────────────────
function makeMockGit(overrides: Partial<SimpleGit> = {}): SimpleGit {
  return {
    log: vi.fn(),
    branch: vi.fn(),
    raw: vi.fn(),
    ...overrides,
  } as unknown as SimpleGit;
}

function makeLogResult(commits: Array<{ hash: string; date: string; author_name: string; message: string; diff?: { changed: number; insertions: number; deletions: number } }>): LogResult {
  return {
    all: commits.map((c) => ({
      hash: c.hash,
      date: c.date,
      message: c.message,
      refs: '',
      body: '',
      author_name: c.author_name,
      author_email: `${c.author_name.toLowerCase().replace(' ', '.')}@test.com`,
      diff: c.diff,
    })),
    total: commits.length,
    latest: commits[0] ?? null,
  } as unknown as LogResult;
}

function makeBranchSummary(branches: Record<string, Partial<BranchSummaryBranch>>): BranchSummary {
  const all = Object.keys(branches);
  return {
    detached: false,
    current: all[0] ?? 'main',
    all,
    branches: Object.fromEntries(
      Object.entries(branches).map(([name, b]) => [
        name,
        {
          current: b.current ?? false,
          linkedWorkTree: b.linkedWorkTree ?? false,
          name,
          commit: b.commit ?? 'abc1234',
          label: b.label ?? name,
        },
      ]),
    ),
  } as BranchSummary;
}

// ── test-health mocks ────────────────────────────────────────────────
const mockRunCommand = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock('../../../src/agents/utils.js', () => ({
  runCommand: mockRunCommand,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    default: {
      ...actual,
      readFile: mockReadFile,
    },
    readFile: mockReadFile,
  };
});

// ── imports under test ───────────────────────────────────────────────
import { collectGitStats } from '../../../src/agents/sensory-cortex/collectors/git-stats.js';
import { collectTestHealth } from '../../../src/agents/sensory-cortex/collectors/test-health.js';

// =====================================================================
// git-stats tests
// =====================================================================
describe('collectGitStats', () => {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
  const fortyDaysAgo = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();

  it('returns correct total_commits from log', async () => {
    const git = makeMockGit();
    const logFn = git.log as ReturnType<typeof vi.fn>;

    // Total log
    logFn.mockResolvedValueOnce(
      makeLogResult([
        { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'init' },
        { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'add' },
        { hash: 'c', date: tenDaysAgo, author_name: 'Alice', message: 'fix' },
        { hash: 'd', date: fortyDaysAgo, author_name: 'Charlie', message: 'old' },
      ]),
    );
    // 7d log
    logFn.mockResolvedValueOnce(
      makeLogResult([
        { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'init' },
        { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'add' },
      ]),
    );
    // 30d log
    logFn.mockResolvedValueOnce(
      makeLogResult([
        { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'init' },
        { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'add' },
        { hash: 'c', date: tenDaysAgo, author_name: 'Alice', message: 'fix' },
      ]),
    );
    // 7d stat log
    logFn.mockResolvedValueOnce(
      makeLogResult([
        { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'init', diff: { changed: 2, insertions: 10, deletions: 5 } },
        { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'add', diff: { changed: 1, insertions: 20, deletions: 0 } },
      ]),
    );

    const branchFn = git.branch as ReturnType<typeof vi.fn>;
    branchFn.mockResolvedValueOnce(
      makeBranchSummary({ main: { current: true }, feature: {} }),
    );

    const rawFn = git.raw as ReturnType<typeof vi.fn>;
    rawFn.mockResolvedValueOnce(oneHourAgo + '\n'); // main
    rawFn.mockResolvedValueOnce(twoDaysAgo + '\n'); // feature

    const result = await collectGitStats(git);
    expect(result.total_commits).toBe(4);
  });

  it('returns correct 7d and 30d commit counts', async () => {
    const git = makeMockGit();
    const logFn = git.log as ReturnType<typeof vi.fn>;

    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b' },
      { hash: 'c', date: tenDaysAgo, author_name: 'Alice', message: 'c' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b' },
      { hash: 'c', date: tenDaysAgo, author_name: 'Alice', message: 'c' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a', diff: { changed: 1, insertions: 5, deletions: 2 } },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b', diff: { changed: 1, insertions: 10, deletions: 3 } },
    ]));

    (git.branch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeBranchSummary({ main: {} }));
    (git.raw as ReturnType<typeof vi.fn>).mockResolvedValueOnce(oneHourAgo + '\n');

    const result = await collectGitStats(git);
    expect(result.commits_last_7d).toBe(2);
    expect(result.commits_last_30d).toBe(3);
  });

  it('counts unique authors in 30d window', async () => {
    const git = makeMockGit();
    const logFn = git.log as ReturnType<typeof vi.fn>;

    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b' },
      { hash: 'c', date: tenDaysAgo, author_name: 'Alice', message: 'c' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
    ]));
    // 30d log: Alice appears twice, Bob once -> 2 unique
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b' },
      { hash: 'c', date: tenDaysAgo, author_name: 'Alice', message: 'c' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a', diff: { changed: 1, insertions: 5, deletions: 0 } },
    ]));

    (git.branch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeBranchSummary({ main: {} }));
    (git.raw as ReturnType<typeof vi.fn>).mockResolvedValueOnce(oneHourAgo + '\n');

    const result = await collectGitStats(git);
    expect(result.unique_authors_30d).toBe(2);
  });

  it('counts active and stale branches', async () => {
    const git = makeMockGit();
    const logFn = git.log as ReturnType<typeof vi.fn>;

    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a', diff: { changed: 1, insertions: 3, deletions: 1 } },
    ]));

    (git.branch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBranchSummary({ main: {}, feature: {}, stale: {} }),
    );

    const rawFn = git.raw as ReturnType<typeof vi.fn>;
    rawFn.mockResolvedValueOnce(oneHourAgo + '\n');       // main – active
    rawFn.mockResolvedValueOnce(twoDaysAgo + '\n');       // feature – active
    rawFn.mockResolvedValueOnce(fortyDaysAgo + '\n');     // stale – stale

    const result = await collectGitStats(git);
    expect(result.active_branches).toBe(2);
    expect(result.stale_branches).toBe(1);
  });

  it('calculates last commit age in hours', async () => {
    const git = makeMockGit();
    const logFn = git.log as ReturnType<typeof vi.fn>;

    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: twoHoursAgo, author_name: 'Alice', message: 'a' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: twoHoursAgo, author_name: 'Alice', message: 'a' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: twoHoursAgo, author_name: 'Alice', message: 'a' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: twoHoursAgo, author_name: 'Alice', message: 'a', diff: { changed: 1, insertions: 5, deletions: 2 } },
    ]));

    (git.branch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeBranchSummary({ main: {} }));
    (git.raw as ReturnType<typeof vi.fn>).mockResolvedValueOnce(twoHoursAgo + '\n');

    const result = await collectGitStats(git);
    // Should be approximately 2 hours (allow some tolerance for test execution time)
    expect(result.last_commit_age_hours).toBeGreaterThanOrEqual(1.9);
    expect(result.last_commit_age_hours).toBeLessThanOrEqual(2.2);
  });

  it('calculates avg commit size', async () => {
    const git = makeMockGit();
    const logFn = git.log as ReturnType<typeof vi.fn>;

    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b' },
    ]));
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a' },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b' },
    ]));
    // stat log: 10+5=15 and 20+0=20, avg = (15+20)/2 = 17.5
    logFn.mockResolvedValueOnce(makeLogResult([
      { hash: 'a', date: oneHourAgo, author_name: 'Alice', message: 'a', diff: { changed: 2, insertions: 10, deletions: 5 } },
      { hash: 'b', date: twoDaysAgo, author_name: 'Bob', message: 'b', diff: { changed: 1, insertions: 20, deletions: 0 } },
    ]));

    (git.branch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeBranchSummary({ main: {} }));
    (git.raw as ReturnType<typeof vi.fn>).mockResolvedValueOnce(oneHourAgo + '\n');

    const result = await collectGitStats(git);
    expect(result.avg_commit_size_lines).toBe(17.5);
  });

  it('handles empty repo (no commits) gracefully', async () => {
    const git = makeMockGit();
    const logFn = git.log as ReturnType<typeof vi.fn>;

    const emptyLog = makeLogResult([]);
    logFn.mockResolvedValueOnce(emptyLog); // total
    logFn.mockResolvedValueOnce(emptyLog); // 7d
    logFn.mockResolvedValueOnce(emptyLog); // 30d
    logFn.mockResolvedValueOnce(emptyLog); // stat

    (git.branch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeBranchSummary({}));

    const result = await collectGitStats(git);
    expect(result.total_commits).toBe(0);
    expect(result.commits_last_7d).toBe(0);
    expect(result.commits_last_30d).toBe(0);
    expect(result.unique_authors_30d).toBe(0);
    expect(result.active_branches).toBe(0);
    expect(result.stale_branches).toBe(0);
    expect(result.last_commit_age_hours).toBe(0);
    expect(result.avg_commit_size_lines).toBe(0);
  });
});

// =====================================================================
// test-health tests
// =====================================================================
describe('collectTestHealth', () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
    mockReadFile.mockReset();
  });

  it('parses vitest JSON output correctly for pass rate', async () => {
    mockRunCommand
      // vitest run --reporter=json
      .mockReturnValueOnce({
        stdout: JSON.stringify({
          numPassedTests: 18,
          numTotalTests: 20,
        }),
        stderr: '',
        status: 0,
      })
      // vitest run --coverage --reporter=json
      .mockReturnValueOnce({
        stdout: '',
        stderr: '',
        status: 0,
      })
      // tsc --noEmit
      .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });

    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({
        total: { statements: { pct: 85.5 } },
      }),
    );

    const result = await collectTestHealth('/repo');
    expect(result.test_pass_rate).toBe(0.9);
  });

  it('returns 0 pass rate when vitest fails', async () => {
    mockRunCommand
      .mockReturnValueOnce({ stdout: '', stderr: 'Error', status: 1 })
      .mockReturnValueOnce({ stdout: '', stderr: '', status: 1 })
      .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });

    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const result = await collectTestHealth('/repo');
    expect(result.test_pass_rate).toBe(0);
  });

  it('reads coverage from coverage-summary.json', async () => {
    mockRunCommand
      .mockReturnValueOnce({
        stdout: JSON.stringify({ numPassedTests: 10, numTotalTests: 10 }),
        stderr: '',
        status: 0,
      })
      .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 })
      .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });

    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({
        total: { statements: { pct: 72.3 } },
      }),
    );

    const result = await collectTestHealth('/repo');
    expect(result.test_coverage_percent).toBe(72.3);
  });

  it('counts lint errors from tsc output', async () => {
    mockRunCommand
      .mockReturnValueOnce({
        stdout: JSON.stringify({ numPassedTests: 5, numTotalTests: 5 }),
        stderr: '',
        status: 0,
      })
      .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 })
      .mockReturnValueOnce({
        stdout: '',
        stderr: [
          'src/index.ts(3,5): error TS2322: Type string is not assignable to type number.',
          'src/utils.ts(10,1): error TS7006: Parameter x implicitly has an any type.',
          'src/main.ts(1,1): error TS1005: ; expected.',
        ].join('\n'),
        status: 2,
      });

    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ total: { statements: { pct: 80 } } }),
    );

    const result = await collectTestHealth('/repo');
    expect(result.lint_error_count).toBe(3);
  });

  it('returns 0 lint errors when tsc passes cleanly', async () => {
    mockRunCommand
      .mockReturnValueOnce({
        stdout: JSON.stringify({ numPassedTests: 5, numTotalTests: 5 }),
        stderr: '',
        status: 0,
      })
      .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 })
      .mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });

    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ total: { statements: { pct: 90 } } }),
    );

    const result = await collectTestHealth('/repo');
    expect(result.lint_error_count).toBe(0);
  });

  it('handles all commands failing gracefully (returns defaults)', async () => {
    mockRunCommand
      .mockReturnValueOnce({ stdout: 'not json', stderr: 'Error', status: 1 })
      .mockReturnValueOnce({ stdout: '', stderr: 'Error', status: 1 })
      .mockReturnValueOnce({ stdout: '', stderr: 'Error', status: 1 });

    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const result = await collectTestHealth('/repo');
    expect(result.test_pass_rate).toBe(0);
    expect(result.test_coverage_percent).toBe(0);
    expect(result.lint_error_count).toBe(0);
  });
});
