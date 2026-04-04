import type { StateReport, TrendResult, Anomaly } from '../types.js';
import type { OrganismConfig } from '../../types.js';

/**
 * Tracked metrics and their paths within a StateReport.
 */
const TRACKED_METRICS: Array<{ metric: string; extract: (r: StateReport) => number }> = [
  { metric: 'quality.test_coverage_percent', extract: (r) => r.quality.test_coverage_percent },
  { metric: 'quality.lint_error_count', extract: (r) => r.quality.lint_error_count },
  { metric: 'performance.pulse_execution_ms', extract: (r) => r.performance.pulse_execution_ms },
  { metric: 'performance.hotspots_execution_ms', extract: (r) => r.performance.hotspots_execution_ms },
  { metric: 'performance.ghosts_execution_ms', extract: (r) => r.performance.ghosts_execution_ms },
  { metric: 'codebase.total_lines', extract: (r) => r.codebase.total_lines },
];

/**
 * Map budget config keys to StateReport performance fields.
 */
const BUDGET_TO_PERF_FIELD: Record<string, keyof StateReport['performance']> = {
  pulse_command: 'pulse_execution_ms',
  hotspots_command: 'hotspots_execution_ms',
  any_new_command: 'ghosts_execution_ms',
};

/**
 * Parse a human-readable performance budget string into milliseconds.
 * Example: "< 2 seconds on repos up to 10k commits" → 2000
 */
function parseBudgetMs(budget: string): number {
  const match = budget.match(/(\d+)\s*seconds?/);
  return match ? parseInt(match[1]!, 10) * 1000 : 10000;
}

/**
 * Analyze historical state reports to identify trends across tracked metrics.
 *
 * Uses the last 5 reports (or all if fewer than 5, minimum 3).
 * For each metric, calculates percentage change between oldest and newest
 * and determines direction based on a ±5% threshold.
 */
export function detectTrends(reports: StateReport[]): TrendResult[] {
  if (reports.length < 3) {
    return [];
  }

  const window = reports.slice(-5);
  const oldest = window[0]!;
  const newest = window[window.length - 1]!;
  const periodCycles = window.length;

  return TRACKED_METRICS.map(({ metric, extract }) => {
    const oldVal = extract(oldest);
    const newVal = extract(newest);

    let changePercent: number;
    if (oldVal === 0) {
      changePercent = newVal === 0 ? 0 : 100;
    } else {
      changePercent = ((newVal - oldVal) / oldVal) * 100;
    }

    let direction: TrendResult['direction'];
    if (changePercent > 5) {
      direction = 'up';
    } else if (changePercent < -5) {
      direction = 'down';
    } else {
      direction = 'stable';
    }

    return {
      metric,
      direction,
      change_percent: changePercent,
      period_cycles: periodCycles,
    };
  });
}

/**
 * Detect anomalies by comparing the current state report against
 * trend data and quality standards from the organism config.
 */
export function detectAnomalies(
  current: StateReport,
  trends: TrendResult[],
  config: OrganismConfig,
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // 1. Quality floor approaching
  const coverage = current.quality.test_coverage_percent;
  const floor = config.quality_standards.test_coverage_floor;
  if (coverage - floor <= 5) {
    anomalies.push({
      type: 'quality_floor_approaching',
      severity: 'warning',
      message: `Test coverage (${coverage}%) is within 5 points of the floor (${floor}%)`,
      data: { current_coverage: coverage, floor },
    });
  }

  // 2. Performance regression
  for (const [budgetKey, perfField] of Object.entries(BUDGET_TO_PERF_FIELD)) {
    const budgetStr = config.quality_standards.performance_budget[budgetKey];
    if (!budgetStr) continue;

    const budgetMs = parseBudgetMs(budgetStr);
    const actualMs = current.performance[perfField] as number;

    if (actualMs > budgetMs) {
      anomalies.push({
        type: 'performance_regression',
        severity: 'critical',
        message: `${perfField} (${actualMs}ms) exceeds budget (${budgetMs}ms)`,
        data: { field: perfField, actual_ms: actualMs, budget_ms: budgetMs },
      });
    }
  }

  // 3. Dependency vulnerability
  if (current.dependencies.vulnerable_count > 0) {
    anomalies.push({
      type: 'dependency_vulnerability',
      severity: 'critical',
      message: `${current.dependencies.vulnerable_count} vulnerable dependencies detected`,
      data: { vulnerable_count: current.dependencies.vulnerable_count },
    });
  }

  // 4. Complexity spike
  const linesTrend = trends.find((t) => t.metric === 'codebase.total_lines');
  if (linesTrend && linesTrend.direction === 'up' && linesTrend.change_percent > 10) {
    anomalies.push({
      type: 'complexity_spike',
      severity: 'warning',
      message: `Codebase size increased by ${linesTrend.change_percent.toFixed(1)}% over ${linesTrend.period_cycles} cycles`,
      data: { change_percent: linesTrend.change_percent, period_cycles: linesTrend.period_cycles },
    });
  }

  return anomalies;
}
