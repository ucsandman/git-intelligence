import { isValidStateReport } from '../../../src/agents/sensory-cortex/index.js';
import type { StateReport } from '../../../src/agents/sensory-cortex/types.js';

function makeValidReport(overrides: Partial<StateReport> = {}): StateReport {
  return {
    timestamp: '2026-04-10T00:00:00.000Z',
    version: '0.1.0',
    git: {
      total_commits: 100,
      commits_last_7d: 10,
      commits_last_30d: 40,
      unique_authors_30d: 3,
      active_branches: 5,
      stale_branches: 1,
      last_commit_age_hours: 2,
      avg_commit_size_lines: 30,
    },
    quality: {
      test_file_count: 10,
      source_file_count: 15,
      test_ratio: 0.67,
      test_pass_rate: 1,
      test_coverage_percent: 85,
      lint_error_count: 0,
      files_exceeding_length_limit: [],
      functions_exceeding_complexity: [],
    },
    performance: {
      pulse_execution_ms: 300,
      hotspots_execution_ms: 1200,
      ghosts_execution_ms: 800,
      benchmarked_against: '/repo',
    },
    dependencies: {
      total_count: 10,
      outdated_count: 0,
      vulnerable_count: 0,
      outdated_packages: [],
      vulnerabilities: [],
    },
    codebase: {
      total_files: 30,
      total_lines: 3000,
      avg_file_length: 100,
      largest_files: [],
      file_type_distribution: {},
    },
    anomalies: [],
    growth_signals: [],
    ...overrides,
  };
}

// Real DashClaw state-report shape — fields are different enough to crash
// giti's trend detector. Captured from DashClaw's .organism/state-reports/.
const dashclawReport = {
  organism: 'dashclaw',
  timestamp: '2026-04-09T19:01:54.909499+00:00',
  collector_status: {
    git_stats: 'ok',
    test_health: 'ok',
    code_quality: 'ok',
    dependency_health: 'ok',
    ci_health: 'ok',
  },
  git_stats: {
    commits_7d: 261,
    commits_30d: 663,
    active_branches: 17,
    stale_branches: 1,
    bus_factor: 1,
    files_changed_7d: 29,
  },
  test_health: {
    test_file_ratio: 0.145,
    untested_routes: [],
  },
  code_quality: {
    files_over_300_lines: 180,
    eslint_status: 'unknown',
    python_files_over_300: 30,
    todo_count: 16,
  },
  dependency_health: {
    js_dependencies: 42,
    js_outdated: 0,
    js_vulnerabilities: 0,
  },
  ci_health: {
    pass_rate_30d: 0.98,
  },
};

describe('isValidStateReport', () => {
  it('accepts a fully-formed giti StateReport', () => {
    expect(isValidStateReport(makeValidReport())).toBe(true);
  });

  it('rejects a DashClaw-style report (foreign organism schema)', () => {
    // This is the exact shape that crashes `giti sense` when run against DashClaw.
    // Regression guard for: "Cannot read properties of undefined (reading 'test_coverage_percent')"
    expect(isValidStateReport(dashclawReport)).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isValidStateReport(null)).toBe(false);
    expect(isValidStateReport(undefined)).toBe(false);
  });

  it('rejects primitives and arrays', () => {
    expect(isValidStateReport(42)).toBe(false);
    expect(isValidStateReport('report')).toBe(false);
    expect(isValidStateReport([])).toBe(false);
  });

  it('rejects a report missing timestamp', () => {
    const r: Partial<StateReport> = { ...makeValidReport() };
    delete (r as { timestamp?: string }).timestamp;
    expect(isValidStateReport(r)).toBe(false);
  });

  it('rejects a report with a non-object quality field', () => {
    expect(isValidStateReport({ ...makeValidReport(), quality: null })).toBe(false);
    expect(isValidStateReport({ ...makeValidReport(), quality: 'broken' })).toBe(false);
  });

  it('rejects a report missing quality.test_coverage_percent', () => {
    const r = makeValidReport();
    const broken = { ...r, quality: { ...r.quality } };
    delete (broken.quality as { test_coverage_percent?: number }).test_coverage_percent;
    expect(isValidStateReport(broken)).toBe(false);
  });

  it('rejects a report missing quality.lint_error_count', () => {
    const r = makeValidReport();
    const broken = { ...r, quality: { ...r.quality } };
    delete (broken.quality as { lint_error_count?: number }).lint_error_count;
    expect(isValidStateReport(broken)).toBe(false);
  });

  it('rejects a report with a non-object performance field', () => {
    expect(isValidStateReport({ ...makeValidReport(), performance: undefined })).toBe(false);
  });

  it('rejects a report missing any performance.*_execution_ms field', () => {
    const r = makeValidReport();
    for (const key of ['pulse_execution_ms', 'hotspots_execution_ms', 'ghosts_execution_ms'] as const) {
      const broken = { ...r, performance: { ...r.performance } };
      delete (broken.performance as Record<string, unknown>)[key];
      expect(isValidStateReport(broken)).toBe(false);
    }
  });

  it('rejects a report missing codebase.total_lines', () => {
    const r = makeValidReport();
    const broken = { ...r, codebase: { ...r.codebase } };
    delete (broken.codebase as { total_lines?: number }).total_lines;
    expect(isValidStateReport(broken)).toBe(false);
  });

  it('rejects a report where a required number field is a string', () => {
    const r = makeValidReport();
    const broken = {
      ...r,
      quality: { ...r.quality, test_coverage_percent: '85' as unknown as number },
    };
    expect(isValidStateReport(broken)).toBe(false);
  });
});
