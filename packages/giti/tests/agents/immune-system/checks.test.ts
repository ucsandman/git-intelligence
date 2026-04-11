import { vi } from 'vitest';
import type { OrganismConfig } from '../../../src/agents/types.js';
import type { Baselines, RegressionContext } from '../../../src/agents/immune-system/types.js';

// ── mocks ──────────────────────────────────────────────────────────

vi.mock('../../../src/agents/utils.js', () => ({
  runCommand: vi.fn(),
}));

vi.mock('../../../src/agents/sensory-cortex/collectors/code-quality.js', () => ({
  collectCodeQuality: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, default: { ...actual, readFile: vi.fn() }, readFile: vi.fn() };
});

const { mockGit, simpleGitFactory } = vi.hoisted(() => {
  const mockGit = {
    diff: vi.fn(),
    show: vi.fn(),
  };
  const simpleGitFactory = vi.fn().mockReturnValue(mockGit);
  return { mockGit, simpleGitFactory };
});

vi.mock('simple-git', () => ({
  default: simpleGitFactory,
}));

/** Restore simple-git mock defaults after vi.resetAllMocks(). */
function restoreGitMocks(): void {
  simpleGitFactory.mockReturnValue(mockGit);
  mockGit.diff.mockResolvedValue('');
  mockGit.show.mockResolvedValue('{}');
}

import fs from 'node:fs/promises';
import { runCommand } from '../../../src/agents/utils.js';
import { collectCodeQuality } from '../../../src/agents/sensory-cortex/collectors/code-quality.js';
import { runTestCheck } from '../../../src/agents/immune-system/checks/test-check.js';
import { runQualityCheck } from '../../../src/agents/immune-system/checks/quality-check.js';
import { runPerformanceCheck } from '../../../src/agents/immune-system/checks/performance-check.js';
import { runBoundaryCheck } from '../../../src/agents/immune-system/checks/boundary-check.js';
import { runRegressionCheck } from '../../../src/agents/immune-system/checks/regression-check.js';
import { runDependencyCheck } from '../../../src/agents/immune-system/checks/dependency-check.js';

const mockRunCommand = vi.mocked(runCommand);
const mockCollectCodeQuality = vi.mocked(collectCodeQuality);
const mockReadFile = vi.mocked(fs.readFile);

// ── shared fixtures ────────────────────────────────────────────────

const mockConfig: OrganismConfig = {
  quality_standards: {
    test_coverage_floor: 80,
    max_complexity_per_function: 15,
    max_file_length: 300,
    zero_tolerance: [],
    performance_budget: {
      pulse_command: '< 2 seconds on repos up to 10k commits',
      hotspots_command: '< 5 seconds on repos up to 10k commits',
      any_new_command: '< 10 seconds on repos up to 10k commits',
    },
  },
  boundaries: { growth_zone: [], forbidden_zone: [] },
  lifecycle: {
    cycle_frequency: 'daily',
    max_changes_per_cycle: 3,
    mandatory_cooldown_after_regression: '48 hours',
    branch_naming: 'organism/{cortex}/{description}',
    requires_immune_approval: true,
  },
};

const mockBaselines: Baselines = {
  last_updated: '2026-04-01T00:00:00.000Z',
  test_coverage: 90,
  test_count: 50,
  lint_errors: 2,
  performance: {
    pulse_ms: 500,
    hotspots_ms: 1500,
    ghosts_ms: 2000,
  },
  complexity: { total: 5000, avg_per_file: 100 },
  dependency_count: 20,
  file_count: 50,
  total_lines: 5000,
};

function vitestJson(total: number, failedNames: string[] = []): string {
  return JSON.stringify({
    numTotalTests: total,
    numFailedTests: failedNames.length,
    numPassedTests: total - failedNames.length,
    testResults: failedNames.length
      ? [
          {
            assertionResults: failedNames.map((fullName) => ({
              status: 'failed',
              fullName,
            })),
          },
        ]
      : [],
  });
}

// ── test-check ─────────────────────────────────────────────────────

describe('runTestCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns pass when all tests pass and coverage is good', async () => {
    // First call: current branch test run
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50),
      stderr: '',
      status: 0,
    });
    // Git baseline comparison calls
    mockRunCommand.mockReturnValueOnce({ stdout: 'feature/test\n', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50),
      stderr: '',
      status: 0,
    });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    // Coverage run
    mockRunCommand.mockReturnValueOnce({
      stdout: '',
      stderr: '',
      status: 0,
    });

    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ total: { statements: { pct: 92 } } }),
    );

    const result = await runTestCheck('/repo', mockBaselines, mockConfig);

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Tests');
    expect(result.message).toContain('50/50 tests passing');
    expect(result.message).toContain('coverage 92%');
  });

  it('returns fail when some tests fail', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50, [
        'suite A > test 1',
        'suite A > test 2',
        'suite B > test 3',
      ]),
      stderr: '',
      status: 1,
    });
    mockRunCommand.mockReturnValueOnce({ stdout: 'feature/test\n', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50),
      stderr: '',
      status: 0,
    });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });

    const result = await runTestCheck('/repo', null, mockConfig);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('3 NEW test failures introduced');
    expect(result.message).toContain('(3 total, 0 pre-existing)');
  });

  it('returns fail when coverage is below floor', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50),
      stderr: '',
      status: 0,
    });
    mockRunCommand.mockReturnValueOnce({ stdout: 'feature/test\n', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50),
      stderr: '',
      status: 0,
    });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({
      stdout: '',
      stderr: '',
      status: 0,
    });

    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ total: { statements: { pct: 65 } } }),
    );

    const result = await runTestCheck('/repo', null, mockConfig);

    expect(result.status).toBe('fail');
    expect(result.message).toBe('Coverage 65% below floor 80%');
  });

  it('returns warn when coverage decreased but is above floor', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50),
      stderr: '',
      status: 0,
    });
    mockRunCommand.mockReturnValueOnce({ stdout: 'feature/test\n', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50),
      stderr: '',
      status: 0,
    });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({ stdout: '', stderr: '', status: 0 });
    mockRunCommand.mockReturnValueOnce({
      stdout: '',
      stderr: '',
      status: 0,
    });

    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ total: { statements: { pct: 85 } } }),
    );

    const result = await runTestCheck('/repo', mockBaselines, mockConfig);

    expect(result.status).toBe('warn');
    expect(result.message).toBe('Coverage decreased from 90% to 85%');
  });

  it('returns fail when vitest command fails entirely', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: 'not valid json',
      stderr: 'vitest not found',
      status: 1,
    });

    const result = await runTestCheck('/repo', null, mockConfig);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('Test runner failed');
  });
});

// ── quality-check ──────────────────────────────────────────────────

describe('runQualityCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns pass when zero lint errors and no violations', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: '',
      stderr: '',
      status: 0,
    });

    mockCollectCodeQuality.mockResolvedValueOnce({
      test_file_count: 10,
      source_file_count: 20,
      test_ratio: 0.333,
      files_exceeding_length_limit: [],
      functions_exceeding_complexity: [],
    });

    const result = await runQualityCheck('/repo', null, mockConfig);

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Quality');
    expect(result.message).toBe('0 lint errors, no files over limit');
  });

  it('returns fail when new lint errors introduced over baseline', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: '',
      stderr: 'src/a.ts(1,1): error TS2304: ...\nsrc/a.ts(5,1): error TS2304: ...\nsrc/b.ts(3,1): error TS2304: ...\nsrc/c.ts(7,1): error TS2304: ...\nsrc/d.ts(2,1): error TS2304: ...',
      status: 1,
    });

    const result = await runQualityCheck('/repo', mockBaselines, mockConfig);

    expect(result.status).toBe('fail');
    expect(result.message).toBe('3 new lint errors introduced');
  });

  it('returns warn when files exceed length limit', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: '',
      stderr: '',
      status: 0,
    });

    mockCollectCodeQuality.mockResolvedValueOnce({
      test_file_count: 10,
      source_file_count: 20,
      test_ratio: 0.333,
      files_exceeding_length_limit: ['src/big-file.ts', 'src/huge-file.ts'],
      functions_exceeding_complexity: [],
    });

    const result = await runQualityCheck('/repo', null, mockConfig);

    expect(result.status).toBe('warn');
    expect(result.message).toBe('2 files over length limit, 0 functions over complexity limit');
  });

  it('returns warn when functions exceed complexity limit', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: '',
      stderr: '',
      status: 0,
    });

    mockCollectCodeQuality.mockResolvedValueOnce({
      test_file_count: 10,
      source_file_count: 20,
      test_ratio: 0.333,
      files_exceeding_length_limit: [],
      functions_exceeding_complexity: ['src/complex.ts:doThings(20)'],
    });

    const result = await runQualityCheck('/repo', null, mockConfig);

    expect(result.status).toBe('warn');
    expect(result.message).toBe('0 files over length limit, 1 functions over complexity limit');
  });
});

// ── performance-check ──────────────────────────────────────────────

describe('runPerformanceCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns pass when all commands are within budget', async () => {
    // Each runCommand call returns instantly (< budget)
    mockRunCommand.mockReturnValue({
      stdout: '{}',
      stderr: '',
      status: 0,
    });

    const result = await runPerformanceCheck('/repo', mockConfig, null);

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Performance');
    expect(result.message).toContain('pulse:');
    expect(result.message).toContain('hotspots:');
    expect(result.message).toContain('ghosts:');
  });

  it('returns fail when command exceeds budget', async () => {
    // Simulate slow command by making Date.now advance
    let callCount = 0;
    const originalDateNow = Date.now;
    let fakeTime = 1000000;

    vi.spyOn(Date, 'now').mockImplementation(() => {
      // Each pair of calls (start/end) for a command:
      // pulse: 0->100 (OK, budget 2000ms)
      // hotspots: 0->100 (OK, budget 5000ms)
      // ghosts: 0->15000 (EXCEEDS budget 10000ms)
      callCount++;
      if (callCount <= 2) {
        // pulse start/end
        fakeTime += 50;
        return fakeTime;
      } else if (callCount <= 4) {
        // hotspots start/end
        fakeTime += 50;
        return fakeTime;
      } else if (callCount === 5) {
        // ghosts start
        return fakeTime;
      } else {
        // ghosts end — 15 seconds later
        return fakeTime + 15000;
      }
    });

    mockRunCommand.mockReturnValue({
      stdout: '{}',
      stderr: '',
      status: 0,
    });

    const result = await runPerformanceCheck('/repo', mockConfig, null);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('ghosts:');
    expect(result.message).toContain('budget:');

    vi.spyOn(Date, 'now').mockRestore();
  });

  it('returns warn when command degraded >10% from baseline', async () => {
    // Simulate degradation: baselines have pulse_ms=500, we measure 600 (>10%)
    let callCount = 0;
    let fakeTime = 1000000;

    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // pulse start
        return fakeTime;
      } else if (callCount === 2) {
        // pulse end — 600ms (>10% over 500ms baseline)
        return fakeTime + 600;
      } else if (callCount === 3) {
        // hotspots start
        fakeTime += 700;
        return fakeTime;
      } else if (callCount === 4) {
        // hotspots end — 100ms (way under 1500ms baseline)
        return fakeTime + 100;
      } else if (callCount === 5) {
        // ghosts start
        fakeTime += 200;
        return fakeTime;
      } else {
        // ghosts end — 100ms (way under 2000ms baseline)
        return fakeTime + 100;
      }
    });

    mockRunCommand.mockReturnValue({
      stdout: '{}',
      stderr: '',
      status: 0,
    });

    const result = await runPerformanceCheck('/repo', mockConfig, mockBaselines);

    expect(result.status).toBe('warn');
    expect(result.message).toContain('pulse degraded from 500ms to 600ms');

    vi.spyOn(Date, 'now').mockRestore();
  });

  it('only checks budgets when no baselines exist (first run)', async () => {
    mockRunCommand.mockReturnValue({
      stdout: '{}',
      stderr: '',
      status: 0,
    });

    const result = await runPerformanceCheck('/repo', mockConfig, null);

    // With no baselines and fast execution, should pass
    expect(result.status).toBe('pass');
    expect(result.message).toContain('pulse:');
  });
});

// ── boundary-check ────────────────────────────────────────────────

describe('runBoundaryCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreGitMocks();
  });

  it('returns pass when no forbidden zone concepts in diff', async () => {
    mockGit.diff
      .mockResolvedValueOnce('src/utils.ts\n') // --name-only
      .mockResolvedValueOnce(
        '+++ b/src/utils.ts\n+export function add(a: number, b: number) {\n+  return a + b;\n+}\n',
      ); // full diff

    const configWithForbidden: OrganismConfig = {
      ...mockConfig,
      boundaries: {
        growth_zone: [],
        forbidden_zone: ['modifying the target repository', 'accessing external APIs'],
      },
    };

    const result = await runBoundaryCheck('/repo', 'feature/test', configWithForbidden);

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Boundary');
    expect(result.message).toBe('No boundary violations detected');
  });

  it('returns fail when forbidden zone keyword found in diff', async () => {
    mockGit.diff
      .mockResolvedValueOnce('src/deploy.ts\n') // --name-only
      .mockResolvedValueOnce(
        '+++ b/src/deploy.ts\n+  await git push origin main\n+  console.log("pushed")\n',
      ); // full diff

    const configWithForbidden: OrganismConfig = {
      ...mockConfig,
      boundaries: {
        growth_zone: [],
        forbidden_zone: ['modifying the target repository'],
      },
    };

    const result = await runBoundaryCheck('/repo', 'feature/deploy', configWithForbidden);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('Forbidden zone violation');
    expect(result.message).toContain('modifying the target repository');
  });

  it('returns warn when package.json changed with new deps', async () => {
    mockGit.diff
      .mockResolvedValueOnce('package.json\nsrc/index.ts\n') // --name-only
      .mockResolvedValueOnce('+  return 1;\n') // full diff (no forbidden keywords)
      .mockResolvedValueOnce(
        '+++ b/package.json\n+    "lodash": "^4.17.21"\n+    "zod": "^3.22.0"\n',
      ); // package.json diff

    const result = await runBoundaryCheck('/repo', 'feature/add-deps', mockConfig);

    expect(result.status).toBe('warn');
    expect(result.message).toContain('2 new dependencies added');
    expect(result.message).toContain('lodash');
    expect(result.message).toContain('zod');
  });

  it('returns pass when no changes detected', async () => {
    mockGit.diff.mockResolvedValueOnce(''); // --name-only returns empty

    const result = await runBoundaryCheck('/repo', 'feature/empty', mockConfig);

    expect(result.status).toBe('pass');
    expect(result.message).toBe('No changes detected');
  });
});

// ── regression-check ──────────────────────────────────────────────

describe('runRegressionCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreGitMocks();
  });

  const mockRegressionContext: RegressionContext = {
    fragile_files: [
      { path: 'src/auth.ts', regression_count: 3, last_regression: '2026-03-01', notes: 'frequent auth bugs' },
      { path: 'src/utils.ts', regression_count: 1, last_regression: '2026-02-15', notes: 'minor issue' },
    ],
  };

  it('returns pass when no regression context provided', async () => {
    const result = await runRegressionCheck('/repo', 'feature/test', null);

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Regression');
    expect(result.message).toBe('No regression history available');
  });

  it('returns fail when changed file has 3+ regressions', async () => {
    mockGit.diff.mockResolvedValueOnce('src/auth.ts\nsrc/index.ts\n');

    const result = await runRegressionCheck('/repo', 'feature/auth-change', mockRegressionContext);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('High-risk file modified: src/auth.ts');
    expect(result.message).toContain('3 previous regressions');
  });

  it('returns warn when changed file has 1-2 regressions', async () => {
    mockGit.diff.mockResolvedValueOnce('src/utils.ts\nsrc/index.ts\n');

    const result = await runRegressionCheck('/repo', 'feature/utils-change', mockRegressionContext);

    expect(result.status).toBe('warn');
    expect(result.message).toContain('Fragile file modified: src/utils.ts');
    expect(result.message).toContain('1 previous regressions');
  });

  it('returns pass when no fragile files in changed set', async () => {
    mockGit.diff.mockResolvedValueOnce('src/index.ts\nsrc/new-feature.ts\n');

    const result = await runRegressionCheck('/repo', 'feature/safe', mockRegressionContext);

    expect(result.status).toBe('pass');
    expect(result.message).toBe('No known fragile files touched');
  });

  it('returns pass when fragile_files list is empty', async () => {
    mockGit.diff.mockResolvedValueOnce('src/auth.ts\n');

    const emptyContext: RegressionContext = { fragile_files: [] };
    const result = await runRegressionCheck('/repo', 'feature/test', emptyContext);

    expect(result.status).toBe('pass');
    expect(result.message).toBe('No regression history available');
  });
});

// ── dependency-check ──────────────────────────────────────────────

describe('runDependencyCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreGitMocks();
  });

  it('returns pass when no new dependencies', async () => {
    const pkg = JSON.stringify({ dependencies: { chalk: '^5.0.0' }, devDependencies: { vitest: '^1.0.0' } });
    mockGit.show
      .mockResolvedValueOnce(pkg) // main:package.json
      .mockResolvedValueOnce(pkg); // branch:package.json

    const result = await runDependencyCheck('/repo', 'feature/no-deps');

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Dependencies');
    expect(result.message).toBe('No new dependencies');
  });

  it('returns warn when new dependency added (no vulnerability)', async () => {
    const mainPkg = JSON.stringify({ dependencies: { chalk: '^5.0.0' } });
    const branchPkg = JSON.stringify({ dependencies: { chalk: '^5.0.0', lodash: '^4.17.21' } });

    mockGit.show
      .mockResolvedValueOnce(mainPkg)
      .mockResolvedValueOnce(branchPkg);

    mockRunCommand.mockReturnValueOnce({
      stdout: JSON.stringify({ vulnerabilities: {} }),
      stderr: '',
      status: 0,
    });

    const result = await runDependencyCheck('/repo', 'feature/add-lodash');

    expect(result.status).toBe('warn');
    expect(result.message).toContain('1 new dependencies added');
    expect(result.message).toContain('lodash');
  });

  it('returns fail when new dependency has vulnerability', async () => {
    const mainPkg = JSON.stringify({ dependencies: { chalk: '^5.0.0' } });
    const branchPkg = JSON.stringify({ dependencies: { chalk: '^5.0.0', 'vulnerable-pkg': '^1.0.0' } });

    mockGit.show
      .mockResolvedValueOnce(mainPkg)
      .mockResolvedValueOnce(branchPkg);

    mockRunCommand.mockReturnValueOnce({
      stdout: JSON.stringify({
        vulnerabilities: {
          'vulnerable-pkg': { severity: 'high' },
        },
      }),
      stderr: '',
      status: 0,
    });

    const result = await runDependencyCheck('/repo', 'feature/add-vuln');

    expect(result.status).toBe('fail');
    expect(result.message).toContain('known vulnerabilities');
    expect(result.message).toContain('vulnerable-pkg');
  });

  it('returns pass when package.json not on main', async () => {
    mockGit.show.mockRejectedValueOnce(new Error('not found'));

    const result = await runDependencyCheck('/repo', 'feature/init');

    expect(result.status).toBe('pass');
    expect(result.message).toBe('No package.json on main branch');
  });
});
