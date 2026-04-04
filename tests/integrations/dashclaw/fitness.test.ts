import { describe, it, expect } from 'vitest';
import type { StateReport } from '../../../src/agents/sensory-cortex/types.js';
import type { CycleResult } from '../../../src/agents/orchestrator/types.js';
import {
  calculateFitnessScore,
  calculateDependencyHealth,
  calculateMutationSuccessRate,
  calculateRegressionRate,
} from '../../../src/integrations/dashclaw/fitness.js';

// ── helpers ─────────────────────────────────────────────────────────────

function makeReport(overrides: {
  test_coverage_percent?: number;
  lint_error_count?: number;
  pulse_execution_ms?: number;
  hotspots_execution_ms?: number;
  ghosts_execution_ms?: number;
  vulnerable_count?: number;
  outdated_count?: number;
} = {}): StateReport {
  return {
    timestamp: '2026-04-04T00:00:00Z',
    version: '1.0.0',
    git: {
      total_commits: 100,
      commits_last_7d: 10,
      commits_last_30d: 40,
      unique_authors_30d: 3,
      active_branches: 2,
      stale_branches: 0,
      last_commit_age_hours: 1,
      avg_commit_size_lines: 50,
    },
    quality: {
      test_file_count: 20,
      source_file_count: 40,
      test_ratio: 0.5,
      test_pass_rate: 1,
      test_coverage_percent: overrides.test_coverage_percent ?? 100,
      lint_error_count: overrides.lint_error_count ?? 0,
      files_exceeding_length_limit: [],
      functions_exceeding_complexity: [],
    },
    performance: {
      pulse_execution_ms: overrides.pulse_execution_ms ?? 500,
      hotspots_execution_ms: overrides.hotspots_execution_ms ?? 500,
      ghosts_execution_ms: overrides.ghosts_execution_ms ?? 500,
      benchmarked_against: 'v1.0.0',
    },
    dependencies: {
      total_count: 10,
      outdated_count: overrides.outdated_count ?? 0,
      vulnerable_count: overrides.vulnerable_count ?? 0,
      outdated_packages: [],
      vulnerabilities: [],
    },
    codebase: {
      total_files: 50,
      total_lines: 5000,
      avg_file_length: 100,
      largest_files: [],
      file_type_distribution: { ts: 40, json: 10 },
    },
    anomalies: [],
    growth_signals: [],
  };
}

function makeCycleResult(overrides: Partial<CycleResult> = {}): CycleResult {
  return {
    cycle: overrides.cycle ?? 1,
    outcome: overrides.outcome ?? 'productive',
    changes_merged: overrides.changes_merged ?? 3,
    changes_attempted: overrides.changes_attempted ?? 3,
    changes_approved: overrides.changes_approved ?? 3,
    changes_rejected: overrides.changes_rejected ?? 0,
    duration_ms: overrides.duration_ms ?? 5000,
    api_tokens_used: overrides.api_tokens_used ?? 1000,
    regressions: overrides.regressions ?? [],
  };
}

// ── calculateFitnessScore ───────────────────────────────────────────────

describe('calculateFitnessScore', () => {
  it('returns near 100 for perfect health', () => {
    const report = makeReport();
    const history = [makeCycleResult()];
    const score = calculateFitnessScore(report, history);
    expect(score).toBe(100);
  });

  it('drops score for low test coverage (50%)', () => {
    const report = makeReport({ test_coverage_percent: 50 });
    const history = [makeCycleResult()];
    const score = calculateFitnessScore(report, history);
    // Coverage contributes 12.5 instead of 25 -> loss of 12.5
    expect(score).toBeLessThan(90);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('drops score for lint errors (5 errors)', () => {
    const report = makeReport({ lint_error_count: 5 });
    const history = [makeCycleResult()];
    const score = calculateFitnessScore(report, history);
    // Lint contributes 15 - 7.5 = 7.5 instead of 15
    expect(score).toBeLessThan(95);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('drops score for performance over budget', () => {
    const report = makeReport({
      pulse_execution_ms: 6000,
      hotspots_execution_ms: 6000,
    });
    const history = [makeCycleResult()];
    const score = calculateFitnessScore(report, history);
    // 2 over budget -> 15 - 10 = 5 instead of 15
    expect(score).toBeLessThan(95);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('drops score for vulnerabilities', () => {
    const report = makeReport({ vulnerable_count: 2 });
    const history = [makeCycleResult()];
    const score = calculateFitnessScore(report, history);
    // Deps: 10 - 10 = 0 instead of 10
    expect(score).toBeLessThan(95);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('drops score for low mutation success rate', () => {
    const report = makeReport();
    const history = [
      makeCycleResult({ changes_attempted: 10, changes_approved: 2 }),
    ];
    const score = calculateFitnessScore(report, history);
    // Mutation: (2/10) * 20 = 4 instead of 20
    expect(score).toBeLessThan(90);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('drops score for high regression rate', () => {
    const report = makeReport();
    const history = [
      makeCycleResult({ changes_merged: 5, regressions: ['broke-something'] }),
      makeCycleResult({ changes_merged: 5, regressions: ['broke-again'] }),
    ];
    const score = calculateFitnessScore(report, history);
    // 2 regressions / 10 merged = 0.2 regRate, 15 * (1 - 0.2*5) = 15 * 0 = 0
    expect(score).toBeLessThan(90);
  });

  it('uses defaults for empty history (full mutation + regression points)', () => {
    const report = makeReport();
    const score = calculateFitnessScore(report, []);
    // All 20 mutation points + 15 regression points given
    expect(score).toBe(100);
  });

  it('clamps score to 0-100 range', () => {
    const report = makeReport({
      test_coverage_percent: 0,
      lint_error_count: 20,
      pulse_execution_ms: 10000,
      hotspots_execution_ms: 10000,
      ghosts_execution_ms: 10000,
      vulnerable_count: 10,
      outdated_count: 20,
    });
    const history = [
      makeCycleResult({ changes_attempted: 10, changes_approved: 0, changes_merged: 1, regressions: ['reg'] }),
    ];
    const score = calculateFitnessScore(report, history);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── calculateDependencyHealth ───────────────────────────────────────────

describe('calculateDependencyHealth', () => {
  it('returns 100 for 0 vulns and 0 outdated', () => {
    const report = makeReport({ vulnerable_count: 0, outdated_count: 0 });
    expect(calculateDependencyHealth(report)).toBe(100);
  });

  it('returns 60 for 2 vulnerabilities', () => {
    const report = makeReport({ vulnerable_count: 2, outdated_count: 0 });
    expect(calculateDependencyHealth(report)).toBe(60);
  });

  it('penalizes outdated packages', () => {
    const report = makeReport({ vulnerable_count: 0, outdated_count: 4 });
    expect(calculateDependencyHealth(report)).toBe(80);
  });

  it('combines vulnerability and outdated penalties', () => {
    const report = makeReport({ vulnerable_count: 1, outdated_count: 4 });
    // 100 - 20 - 20 = 60
    expect(calculateDependencyHealth(report)).toBe(60);
  });

  it('clamps to 0 for extreme penalties', () => {
    const report = makeReport({ vulnerable_count: 5, outdated_count: 10 });
    expect(calculateDependencyHealth(report)).toBe(0);
  });
});

// ── calculateMutationSuccessRate ────────────────────────────────────────

describe('calculateMutationSuccessRate', () => {
  it('returns 1 for empty history', () => {
    expect(calculateMutationSuccessRate([])).toBe(1);
  });

  it('returns 0.8 for 10 attempted / 8 approved', () => {
    const history = [
      makeCycleResult({ changes_attempted: 10, changes_approved: 8 }),
    ];
    expect(calculateMutationSuccessRate(history)).toBe(0.8);
  });

  it('returns 1 when 0 attempted (all approved by default)', () => {
    const history = [
      makeCycleResult({ changes_attempted: 0, changes_approved: 0 }),
    ];
    expect(calculateMutationSuccessRate(history)).toBe(1);
  });

  it('aggregates across multiple cycles', () => {
    const history = [
      makeCycleResult({ changes_attempted: 5, changes_approved: 4 }),
      makeCycleResult({ changes_attempted: 5, changes_approved: 4 }),
    ];
    // 8/10 = 0.8
    expect(calculateMutationSuccessRate(history)).toBe(0.8);
  });
});

// ── calculateRegressionRate ─────────────────────────────────────────────

describe('calculateRegressionRate', () => {
  it('returns 0 for empty history', () => {
    expect(calculateRegressionRate([])).toBe(0);
  });

  it('returns 0.2 for 10 merged / 2 regressions', () => {
    const history = [
      makeCycleResult({ changes_merged: 5, regressions: ['r1'] }),
      makeCycleResult({ changes_merged: 5, regressions: ['r2'] }),
    ];
    expect(calculateRegressionRate(history)).toBe(0.2);
  });

  it('returns 0 when no regressions', () => {
    const history = [
      makeCycleResult({ changes_merged: 5, regressions: [] }),
      makeCycleResult({ changes_merged: 5, regressions: [] }),
    ];
    expect(calculateRegressionRate(history)).toBe(0);
  });

  it('returns 0 when 0 merged', () => {
    const history = [
      makeCycleResult({ changes_merged: 0, regressions: ['r1'] }),
    ];
    expect(calculateRegressionRate(history)).toBe(0);
  });
});
