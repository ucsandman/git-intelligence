import { vi } from 'vitest';
import type { OrganismConfig } from '../../../src/agents/types.js';
import type { Baselines } from '../../../src/agents/immune-system/types.js';

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

import fs from 'node:fs/promises';
import { runCommand } from '../../../src/agents/utils.js';
import { collectCodeQuality } from '../../../src/agents/sensory-cortex/collectors/code-quality.js';
import { runTestCheck } from '../../../src/agents/immune-system/checks/test-check.js';
import { runQualityCheck } from '../../../src/agents/immune-system/checks/quality-check.js';
import { runPerformanceCheck } from '../../../src/agents/immune-system/checks/performance-check.js';

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

function vitestJson(total: number, failed: number): string {
  return JSON.stringify({
    numTotalTests: total,
    numFailedTests: failed,
    numPassedTests: total - failed,
  });
}

// ── test-check ─────────────────────────────────────────────────────

describe('runTestCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns pass when all tests pass and coverage is good', async () => {
    // First call: vitest run (tests)
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50, 0),
      stderr: '',
      status: 0,
    });
    // Second call: vitest run --coverage
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
      stdout: vitestJson(50, 3),
      stderr: '',
      status: 1,
    });

    const result = await runTestCheck('/repo', null, mockConfig);

    expect(result.status).toBe('fail');
    expect(result.message).toBe('3 tests failed out of 50');
  });

  it('returns fail when coverage is below floor', async () => {
    mockRunCommand.mockReturnValueOnce({
      stdout: vitestJson(50, 0),
      stderr: '',
      status: 0,
    });
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
      stdout: vitestJson(50, 0),
      stderr: '',
      status: 0,
    });
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
