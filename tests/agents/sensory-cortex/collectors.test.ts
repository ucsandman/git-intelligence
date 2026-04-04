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

// ── shared mocks ────────────────────────────────────────────────────
const mockRunCommand = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());
const mockReaddir = vi.hoisted(() => vi.fn());

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
      readdir: mockReaddir,
    },
    readFile: mockReadFile,
    readdir: mockReaddir,
  };
});

// ── imports under test ───────────────────────────────────────────────
import { collectGitStats } from '../../../src/agents/sensory-cortex/collectors/git-stats.js';
import { collectTestHealth } from '../../../src/agents/sensory-cortex/collectors/test-health.js';
import { collectCodeQuality, calculateFunctionComplexities } from '../../../src/agents/sensory-cortex/collectors/code-quality.js';
import { collectDependencyHealth, determineSeverity } from '../../../src/agents/sensory-cortex/collectors/dependency-health.js';
import { collectPerformance } from '../../../src/agents/sensory-cortex/collectors/performance.js';

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

// =====================================================================
// code-quality tests
// =====================================================================

function makeDirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir, isFile: () => !isDir };
}

describe('collectCodeQuality', () => {
  beforeEach(() => {
    mockReaddir.mockReset();
    mockReadFile.mockReset();
  });

  it('counts source files and test files correctly', async () => {
    // Root readdir
    mockReaddir.mockResolvedValueOnce([
      makeDirent('app.ts', false),
      makeDirent('utils.ts', false),
      makeDirent('app.test.ts', false),
    ]);

    // readFile for each file (short content)
    mockReadFile
      .mockResolvedValueOnce('const x = 1;\n')
      .mockResolvedValueOnce('const y = 2;\n')
      .mockResolvedValueOnce('test("works", () => {});\n');

    const result = await collectCodeQuality('/repo', 300, 15);
    expect(result.source_file_count).toBe(2);
    expect(result.test_file_count).toBe(1);
  });

  it('calculates test ratio', async () => {
    mockReaddir.mockResolvedValueOnce([
      makeDirent('a.ts', false),
      makeDirent('b.ts', false),
      makeDirent('a.test.ts', false),
      makeDirent('b.spec.ts', false),
    ]);

    mockReadFile
      .mockResolvedValueOnce('line\n')
      .mockResolvedValueOnce('line\n')
      .mockResolvedValueOnce('line\n')
      .mockResolvedValueOnce('line\n');

    const result = await collectCodeQuality('/repo', 300, 15);
    // 2 test / 4 total = 0.5
    expect(result.test_ratio).toBe(0.5);
  });

  it('flags files exceeding length limit', async () => {
    mockReaddir.mockResolvedValueOnce([
      makeDirent('big.ts', false),
      makeDirent('small.ts', false),
    ]);

    const bigContent = Array.from({ length: 350 }, (_, i) => `line ${i}`).join('\n');
    mockReadFile
      .mockResolvedValueOnce(bigContent)
      .mockResolvedValueOnce('short\n');

    const result = await collectCodeQuality('/repo', 300, 15);
    expect(result.files_exceeding_length_limit).toContain('big.ts');
    expect(result.files_exceeding_length_limit).not.toContain('small.ts');
  });

  it('detects functions exceeding complexity threshold', async () => {
    mockReaddir.mockResolvedValueOnce([
      makeDirent('complex.ts', false),
    ]);

    const complexCode = `function doStuff(x: number) {
  if (x > 0) {
    for (let i = 0; i < x; i++) {
      if (i % 2 === 0) {
        while (true) {
          if (i > 10 && x > 5) {
            break;
          }
          if (i > 20 || x > 100) {
            break;
          }
        }
      }
    }
  }
}`;
    mockReadFile.mockResolvedValueOnce(complexCode);

    // threshold = 3 so it should be flagged
    const result = await collectCodeQuality('/repo', 300, 3);
    expect(result.functions_exceeding_complexity.length).toBeGreaterThan(0);
    expect(result.functions_exceeding_complexity[0]).toContain('doStuff');
  });

  it('handles empty directory', async () => {
    mockReaddir.mockResolvedValueOnce([]);

    const result = await collectCodeQuality('/repo', 300, 15);
    expect(result.source_file_count).toBe(0);
    expect(result.test_file_count).toBe(0);
    expect(result.test_ratio).toBe(0);
    expect(result.files_exceeding_length_limit).toEqual([]);
    expect(result.functions_exceeding_complexity).toEqual([]);
  });

  it('walks subdirectories but skips excluded dirs', async () => {
    // Root
    mockReaddir.mockResolvedValueOnce([
      makeDirent('src', true),
      makeDirent('node_modules', true),
      makeDirent('index.ts', false),
    ]);
    // src/
    mockReaddir.mockResolvedValueOnce([
      makeDirent('app.ts', false),
    ]);
    // node_modules should NOT be entered

    mockReadFile
      .mockResolvedValueOnce('line\n') // index.ts
      .mockResolvedValueOnce('line\n'); // src/app.ts

    const result = await collectCodeQuality('/repo', 300, 15);
    expect(result.source_file_count).toBe(2);
  });
});

describe('calculateFunctionComplexities', () => {
  it('counts branches correctly for a known code snippet', () => {
    const code = `function process(items: string[]) {
  if (items.length === 0) return;
  for (const item of items) {
    if (item === 'a' || item === 'b') {
      console.log(item);
    } else if (item === 'c') {
      try {
        JSON.parse(item);
      } catch (e) {
        console.error(e);
      }
    }
  }
}`;
    const result = calculateFunctionComplexities(code, 'test.ts');
    expect(result.length).toBe(1);
    expect(result[0]!.name).toBe('process');
    // Base 1 + if + for + if + || + else if + catch = 7
    expect(result[0]!.complexity).toBe(7);
  });

  it('returns base complexity 1 for simple function', () => {
    const code = `function simple() {
  return 42;
}`;
    const result = calculateFunctionComplexities(code, 'test.ts');
    expect(result.length).toBe(1);
    expect(result[0]!.complexity).toBe(1);
  });

  it('counts ternary operator', () => {
    const code = `function choose(x: number) {
  return x > 0 ? 'positive' : 'non-positive';
}`;
    const result = calculateFunctionComplexities(code, 'test.ts');
    expect(result.length).toBe(1);
    // Base 1 + ternary 1 = 2
    expect(result[0]!.complexity).toBe(2);
  });

  it('counts nullish coalescing and logical operators', () => {
    const code = `function fallback(a: string | null, b: string | null) {
  const x = a ?? b ?? 'default';
  const y = a && b;
  return x || y;
}`;
    const result = calculateFunctionComplexities(code, 'test.ts');
    expect(result.length).toBe(1);
    // Base 1 + ?? + ?? + && + || = 5
    expect(result[0]!.complexity).toBe(5);
  });
});

// =====================================================================
// dependency-health tests
// =====================================================================
describe('collectDependencyHealth', () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
    mockReadFile.mockReset();
  });

  it('parses npm outdated JSON correctly', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { lodash: '^4.0.0' },
        devDependencies: { vitest: '^1.0.0' },
      }),
    );

    mockRunCommand
      // npm outdated
      .mockReturnValueOnce({
        stdout: JSON.stringify({
          lodash: { current: '4.17.20', wanted: '4.17.21', latest: '5.0.0' },
        }),
        stderr: '',
        status: 1,
      })
      // npm audit
      .mockReturnValueOnce({
        stdout: JSON.stringify({ vulnerabilities: {} }),
        stderr: '',
        status: 0,
      });

    const result = await collectDependencyHealth('/repo');
    expect(result.outdated_count).toBe(1);
    expect(result.outdated_packages[0]!.name).toBe('lodash');
    expect(result.outdated_packages[0]!.severity).toBe('major');
  });

  it('handles no outdated packages (empty JSON)', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { a: '1.0.0' } }),
    );

    mockRunCommand
      .mockReturnValueOnce({ stdout: '{}', stderr: '', status: 0 })
      .mockReturnValueOnce({
        stdout: JSON.stringify({ vulnerabilities: {} }),
        stderr: '',
        status: 0,
      });

    const result = await collectDependencyHealth('/repo');
    expect(result.outdated_count).toBe(0);
    expect(result.outdated_packages).toEqual([]);
  });

  it('parses npm audit JSON for vulnerabilities', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ dependencies: { express: '4.0.0' } }),
    );

    mockRunCommand
      .mockReturnValueOnce({ stdout: '{}', stderr: '', status: 0 })
      .mockReturnValueOnce({
        stdout: JSON.stringify({
          vulnerabilities: {
            express: {
              severity: 'high',
              via: [{ title: 'Prototype pollution' }],
            },
            qs: {
              severity: 'moderate',
              via: ['express'],
            },
          },
        }),
        stderr: '',
        status: 0,
      });

    const result = await collectDependencyHealth('/repo');
    expect(result.vulnerable_count).toBe(2);
    expect(result.vulnerabilities[0]!.package).toBe('express');
    expect(result.vulnerabilities[0]!.severity).toBe('high');
    expect(result.vulnerabilities[0]!.description).toBe('Prototype pollution');
  });

  it('counts total deps from package.json', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { a: '1.0.0', b: '2.0.0' },
        devDependencies: { c: '3.0.0' },
      }),
    );

    mockRunCommand
      .mockReturnValueOnce({ stdout: '{}', stderr: '', status: 0 })
      .mockReturnValueOnce({
        stdout: JSON.stringify({ vulnerabilities: {} }),
        stderr: '',
        status: 0,
      });

    const result = await collectDependencyHealth('/repo');
    expect(result.total_count).toBe(3);
  });
});

describe('determineSeverity', () => {
  it('returns major when major version differs', () => {
    expect(determineSeverity('1.2.3', '2.0.0')).toBe('major');
  });

  it('returns minor when minor version differs', () => {
    expect(determineSeverity('1.2.3', '1.5.0')).toBe('minor');
  });

  it('returns patch when only patch version differs', () => {
    expect(determineSeverity('1.2.3', '1.2.5')).toBe('patch');
  });
});

// =====================================================================
// performance tests
// =====================================================================
describe('collectPerformance', () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
    vi.restoreAllMocks();
  });

  it('measures execution time and takes median of 3 runs', async () => {
    // Mock Date.now to control timing: each run takes a known amount of "time"
    let callCount = 0;
    const times = [
      // pulse runs: start/end pairs
      1000, 1100, // run 1: 100ms
      1200, 1350, // run 2: 150ms
      1400, 1520, // run 3: 120ms
      // hotspots runs
      2000, 2200, // run 1: 200ms
      2300, 2550, // run 2: 250ms
      2600, 2830, // run 3: 230ms
      // ghosts runs
      3000, 3050, // run 1: 50ms
      3100, 3180, // run 2: 80ms
      3200, 3260, // run 3: 60ms
    ];
    vi.spyOn(Date, 'now').mockImplementation(() => times[callCount++]!);

    mockRunCommand.mockReturnValue({ stdout: '{}', stderr: '', status: 0 });

    const result = await collectPerformance('/repo');

    // Median of [100, 150, 120] sorted=[100,120,150] -> 120
    expect(result.pulse_execution_ms).toBe(120);
    // Median of [200, 250, 230] sorted=[200,230,250] -> 230
    expect(result.hotspots_execution_ms).toBe(230);
    // Median of [50, 80, 60] sorted=[50,60,80] -> 60
    expect(result.ghosts_execution_ms).toBe(60);
    expect(result.benchmarked_against).toBe('/repo');
  });

  it('returns all command benchmarks', async () => {
    let callCount = 0;
    const times = Array.from({ length: 18 }, (_, i) => 1000 + i * 10);
    vi.spyOn(Date, 'now').mockImplementation(() => times[callCount++]!);

    mockRunCommand.mockReturnValue({ stdout: '{}', stderr: '', status: 0 });

    const result = await collectPerformance('/my/repo');

    expect(result).toHaveProperty('pulse_execution_ms');
    expect(result).toHaveProperty('hotspots_execution_ms');
    expect(result).toHaveProperty('ghosts_execution_ms');
    expect(result).toHaveProperty('benchmarked_against');
    expect(result.benchmarked_against).toBe('/my/repo');
    expect(typeof result.pulse_execution_ms).toBe('number');
    expect(typeof result.hotspots_execution_ms).toBe('number');
    expect(typeof result.ghosts_execution_ms).toBe('number');
  });

  it('calls runCommand 9 times (3 commands x 3 runs)', async () => {
    let callCount = 0;
    const times = Array.from({ length: 18 }, (_, i) => 1000 + i * 50);
    vi.spyOn(Date, 'now').mockImplementation(() => times[callCount++]!);

    mockRunCommand.mockReturnValue({ stdout: '{}', stderr: '', status: 0 });

    await collectPerformance('/repo');

    expect(mockRunCommand).toHaveBeenCalledTimes(9);
    // Verify each command was called with expected args
    expect(mockRunCommand).toHaveBeenCalledWith('node', ['dist/index.js', 'pulse', '--json'], '/repo');
    expect(mockRunCommand).toHaveBeenCalledWith('node', ['dist/index.js', 'hotspots', '--json'], '/repo');
    expect(mockRunCommand).toHaveBeenCalledWith('node', ['dist/index.js', 'ghosts', '--json'], '/repo');
  });
});
