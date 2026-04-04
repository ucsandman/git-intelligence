import { detectTrends, detectAnomalies } from '../../../src/agents/sensory-cortex/analyzers/trend-detector.js';
import type { StateReport, TrendResult } from '../../../src/agents/sensory-cortex/types.js';
import type { OrganismConfig } from '../../../src/agents/types.js';

// ── helpers ─────────────────────────────────────────────────────────

function makeReport(overrides: Partial<StateReport> = {}): StateReport {
  return {
    timestamp: new Date().toISOString(),
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

function makeConfig(overrides: Partial<OrganismConfig> = {}): OrganismConfig {
  return {
    quality_standards: {
      test_coverage_floor: 80,
      max_complexity_per_function: 10,
      max_file_length: 300,
      zero_tolerance: ['security-vulnerabilities'],
      performance_budget: {
        pulse_command: '< 2 seconds on repos up to 10k commits',
        hotspots_command: '< 5 seconds on repos up to 10k commits',
        any_new_command: '< 3 seconds on repos up to 10k commits',
      },
    },
    boundaries: {
      growth_zone: ['src/'],
      forbidden_zone: ['node_modules/'],
    },
    lifecycle: {
      cycle_frequency: '6 hours',
      max_changes_per_cycle: 3,
      mandatory_cooldown_after_regression: '24 hours',
      branch_naming: 'giti/cycle-{n}/{slug}',
      requires_immune_approval: true,
    },
    ...overrides,
  };
}

// ── detectTrends ────────────────────────────────────────────────────

describe('detectTrends', () => {
  it('returns empty array for fewer than 3 reports', () => {
    expect(detectTrends([])).toEqual([]);
    expect(detectTrends([makeReport()])).toEqual([]);
    expect(detectTrends([makeReport(), makeReport()])).toEqual([]);
  });

  it('detects coverage trending down', () => {
    const reports = [
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 90 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 87 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 84 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 82 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 80 } }),
    ];
    const trends = detectTrends(reports);
    const coverageTrend = trends.find((t) => t.metric === 'quality.test_coverage_percent');
    expect(coverageTrend).toBeDefined();
    expect(coverageTrend!.direction).toBe('down');
    // (80 - 90) / 90 * 100 = -11.11%
    expect(coverageTrend!.change_percent).toBeCloseTo(-11.11, 1);
    expect(coverageTrend!.period_cycles).toBe(5);
  });

  it('detects performance trending up (regression)', () => {
    const reports = [
      makeReport({ performance: { ...makeReport().performance, pulse_execution_ms: 500 } }),
      makeReport({ performance: { ...makeReport().performance, pulse_execution_ms: 600 } }),
      makeReport({ performance: { ...makeReport().performance, pulse_execution_ms: 700 } }),
      makeReport({ performance: { ...makeReport().performance, pulse_execution_ms: 750 } }),
      makeReport({ performance: { ...makeReport().performance, pulse_execution_ms: 800 } }),
    ];
    const trends = detectTrends(reports);
    const pulseTrend = trends.find((t) => t.metric === 'performance.pulse_execution_ms');
    expect(pulseTrend).toBeDefined();
    expect(pulseTrend!.direction).toBe('up');
    // (800 - 500) / 500 * 100 = 60%
    expect(pulseTrend!.change_percent).toBeCloseTo(60, 1);
  });

  it('identifies stable metrics (< 5% change)', () => {
    const reports = [
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 85 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 85 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 86 } }),
    ];
    const trends = detectTrends(reports);
    const coverageTrend = trends.find((t) => t.metric === 'quality.test_coverage_percent');
    expect(coverageTrend).toBeDefined();
    expect(coverageTrend!.direction).toBe('stable');
  });

  it('uses only last 5 reports when more are provided', () => {
    // First 3 reports have coverage 50 — should be ignored
    const reports = [
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 50 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 50 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 50 } }),
      // Last 5 reports: 85 → 85
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 85 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 85 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 85 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 85 } }),
      makeReport({ quality: { ...makeReport().quality, test_coverage_percent: 85 } }),
    ];
    const trends = detectTrends(reports);
    const coverageTrend = trends.find((t) => t.metric === 'quality.test_coverage_percent');
    expect(coverageTrend).toBeDefined();
    expect(coverageTrend!.direction).toBe('stable');
    expect(coverageTrend!.change_percent).toBeCloseTo(0, 1);
    expect(coverageTrend!.period_cycles).toBe(5);
  });

  it('handles oldest=0 case correctly', () => {
    // Both 0 → change_percent = 0
    const reportsZeroToZero = [
      makeReport({ quality: { ...makeReport().quality, lint_error_count: 0 } }),
      makeReport({ quality: { ...makeReport().quality, lint_error_count: 0 } }),
      makeReport({ quality: { ...makeReport().quality, lint_error_count: 0 } }),
    ];
    const trends1 = detectTrends(reportsZeroToZero);
    const lintTrend1 = trends1.find((t) => t.metric === 'quality.lint_error_count');
    expect(lintTrend1).toBeDefined();
    expect(lintTrend1!.change_percent).toBe(0);

    // 0 → nonzero → change_percent = 100
    const reportsZeroToNonzero = [
      makeReport({ quality: { ...makeReport().quality, lint_error_count: 0 } }),
      makeReport({ quality: { ...makeReport().quality, lint_error_count: 3 } }),
      makeReport({ quality: { ...makeReport().quality, lint_error_count: 5 } }),
    ];
    const trends2 = detectTrends(reportsZeroToNonzero);
    const lintTrend2 = trends2.find((t) => t.metric === 'quality.lint_error_count');
    expect(lintTrend2).toBeDefined();
    expect(lintTrend2!.change_percent).toBe(100);
  });

  it('returns correct number of trend results (one per tracked metric)', () => {
    const reports = [makeReport(), makeReport(), makeReport()];
    const trends = detectTrends(reports);
    // 6 tracked metrics
    expect(trends).toHaveLength(6);
  });
});

// ── detectAnomalies ─────────────────────────────────────────────────

describe('detectAnomalies', () => {
  it('returns no anomalies when everything is healthy', () => {
    const report = makeReport({
      quality: { ...makeReport().quality, test_coverage_percent: 95 },
      dependencies: { ...makeReport().dependencies, vulnerable_count: 0 },
    });
    const trends: TrendResult[] = [
      { metric: 'codebase.total_lines', direction: 'stable', change_percent: 2, period_cycles: 5 },
    ];
    const config = makeConfig();
    const anomalies = detectAnomalies(report, trends, config);
    expect(anomalies).toEqual([]);
  });

  it('detects quality_floor_approaching when coverage is within 5% of floor', () => {
    const report = makeReport({
      quality: { ...makeReport().quality, test_coverage_percent: 83 },
    });
    const config = makeConfig(); // floor = 80
    const anomalies = detectAnomalies(report, [], config);
    const qfa = anomalies.find((a) => a.type === 'quality_floor_approaching');
    expect(qfa).toBeDefined();
    expect(qfa!.severity).toBe('warning');
  });

  it('does NOT flag quality_floor_approaching when coverage is well above floor', () => {
    const report = makeReport({
      quality: { ...makeReport().quality, test_coverage_percent: 95 },
    });
    const config = makeConfig(); // floor = 80
    const anomalies = detectAnomalies(report, [], config);
    const qfa = anomalies.find((a) => a.type === 'quality_floor_approaching');
    expect(qfa).toBeUndefined();
  });

  it('detects quality_floor_approaching at exact boundary (floor + 5)', () => {
    // 85% coverage with 80% floor → exactly 5 points above → should flag (within 5)
    const report = makeReport({
      quality: { ...makeReport().quality, test_coverage_percent: 85 },
    });
    const config = makeConfig(); // floor = 80
    const anomalies = detectAnomalies(report, [], config);
    const qfa = anomalies.find((a) => a.type === 'quality_floor_approaching');
    expect(qfa).toBeDefined();
  });

  it('detects performance_regression when command exceeds budget', () => {
    // pulse budget is 2 seconds (2000ms), current is 2500ms
    const report = makeReport({
      performance: { ...makeReport().performance, pulse_execution_ms: 2500 },
    });
    const config = makeConfig();
    const anomalies = detectAnomalies(report, [], config);
    const pr = anomalies.find((a) => a.type === 'performance_regression');
    expect(pr).toBeDefined();
    expect(pr!.severity).toBe('critical');
  });

  it('does NOT flag performance_regression when within budget', () => {
    const report = makeReport({
      performance: { ...makeReport().performance, pulse_execution_ms: 1500 },
    });
    const config = makeConfig();
    const anomalies = detectAnomalies(report, [], config);
    const pr = anomalies.find((a) => a.type === 'performance_regression');
    expect(pr).toBeUndefined();
  });

  it('detects dependency_vulnerability when vulnerable_count > 0', () => {
    const report = makeReport({
      dependencies: { ...makeReport().dependencies, vulnerable_count: 3 },
    });
    const config = makeConfig();
    const anomalies = detectAnomalies(report, [], config);
    const dv = anomalies.find((a) => a.type === 'dependency_vulnerability');
    expect(dv).toBeDefined();
    expect(dv!.severity).toBe('critical');
  });

  it('does NOT flag dependency_vulnerability when vulnerable_count is 0', () => {
    const report = makeReport();
    const config = makeConfig();
    const anomalies = detectAnomalies(report, [], config);
    const dv = anomalies.find((a) => a.type === 'dependency_vulnerability');
    expect(dv).toBeUndefined();
  });

  it('detects complexity_spike when total_lines trending up >10%', () => {
    const report = makeReport();
    const trends: TrendResult[] = [
      { metric: 'codebase.total_lines', direction: 'up', change_percent: 15, period_cycles: 5 },
    ];
    const config = makeConfig();
    const anomalies = detectAnomalies(report, trends, config);
    const cs = anomalies.find((a) => a.type === 'complexity_spike');
    expect(cs).toBeDefined();
    expect(cs!.severity).toBe('warning');
  });

  it('does NOT flag complexity_spike when change_percent <= 10', () => {
    const report = makeReport();
    const trends: TrendResult[] = [
      { metric: 'codebase.total_lines', direction: 'up', change_percent: 8, period_cycles: 5 },
    ];
    const config = makeConfig();
    const anomalies = detectAnomalies(report, trends, config);
    const cs = anomalies.find((a) => a.type === 'complexity_spike');
    expect(cs).toBeUndefined();
  });

  it('returns multiple anomalies simultaneously', () => {
    const report = makeReport({
      quality: { ...makeReport().quality, test_coverage_percent: 82 },
      dependencies: { ...makeReport().dependencies, vulnerable_count: 2 },
      performance: { ...makeReport().performance, pulse_execution_ms: 5000 },
    });
    const trends: TrendResult[] = [
      { metric: 'codebase.total_lines', direction: 'up', change_percent: 20, period_cycles: 5 },
    ];
    const config = makeConfig();
    const anomalies = detectAnomalies(report, trends, config);

    const types = anomalies.map((a) => a.type);
    expect(types).toContain('quality_floor_approaching');
    expect(types).toContain('dependency_vulnerability');
    expect(types).toContain('performance_regression');
    expect(types).toContain('complexity_spike');
    expect(anomalies.length).toBe(4);
  });
});
