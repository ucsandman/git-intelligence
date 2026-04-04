import chalk from 'chalk';
import type { StateReport, Anomaly } from './types.js';

/**
 * Format a millisecond value for display.
 * < 1000 → "Xms", >= 1000 → "X.Ys"
 */
function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Determine quality line status and text.
 * ✅ if lint_error_count=0 AND no files over limit AND no functions over complexity.
 * ❌ if lint errors > 0 or both lists non-empty.
 * ⚠️ otherwise.
 */
function formatQualityLine(report: StateReport): string {
  const { lint_error_count, files_exceeding_length_limit, functions_exceeding_complexity, test_coverage_percent } = report.quality;
  const coveragePct = Math.round(test_coverage_percent);
  const fileCount = files_exceeding_length_limit.length;
  const fnCount = functions_exceeding_complexity.length;

  const details = `${coveragePct}% coverage | ${lint_error_count} lint errors | ${fileCount} files over limit`;

  if (lint_error_count === 0 && fileCount === 0 && fnCount === 0) {
    return chalk.green(`✅ ${details}`);
  }
  if (lint_error_count > 0) {
    return chalk.red(`❌ ${details}`);
  }
  return chalk.yellow(`⚠️  ${details}`);
}

/**
 * Determine performance line status and text.
 * ✅ if no performance_regression anomalies.
 * ❌ if any performance_regression anomaly.
 */
function formatPerformanceLine(report: StateReport): string {
  const { pulse_execution_ms, hotspots_execution_ms, ghosts_execution_ms } = report.performance;
  const details = `pulse: ${formatMs(pulse_execution_ms)} | hotspots: ${formatMs(hotspots_execution_ms)} | ghosts: ${formatMs(ghosts_execution_ms)}`;

  const hasRegression = report.anomalies.some((a) => a.type === 'performance_regression');
  if (hasRegression) {
    return chalk.red(`❌ ${details}`);
  }
  return chalk.green(`✅ ${details}`);
}

/**
 * Determine dependencies line status and text.
 * ✅ if outdated_count=0 AND vulnerable_count=0.
 * ⚠️ if outdated but no vulnerabilities.
 * ❌ if vulnerabilities.
 */
function formatDependenciesLine(report: StateReport): string {
  const { outdated_count, vulnerable_count, outdated_packages } = report.dependencies;

  // Determine severity breakdown for outdated
  let outdatedLabel = `${outdated_count} outdated`;
  if (outdated_count > 0) {
    const severities = new Set(outdated_packages.map((p) => p.severity));
    const severityList = [...severities].join(', ');
    outdatedLabel = `${outdated_count} outdated (${severityList})`;
  }

  const details = `${outdatedLabel} | ${vulnerable_count} vulnerabilities`;

  if (vulnerable_count > 0) {
    return chalk.red(`❌ ${details}`);
  }
  if (outdated_count > 0) {
    return chalk.yellow(`⚠️  ${details}`);
  }
  return chalk.green(`✅ ${details}`);
}

/**
 * Format anomalies summary line.
 * Count by severity. Show count and first anomaly message. If none, show "none".
 */
function formatAnomaliesLine(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) {
    return chalk.green('none');
  }

  const bySeverity: Record<string, number> = {};
  for (const a of anomalies) {
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  }

  const parts: string[] = [];
  for (const [severity, count] of Object.entries(bySeverity)) {
    parts.push(`${count} ${severity}`);
  }

  const firstMessage = anomalies[0]!.message;
  const summary = `${parts.join(', ')} — ${firstMessage}`;

  const hasCritical = anomalies.some((a) => a.severity === 'critical');
  if (hasCritical) {
    return chalk.red(summary);
  }
  return chalk.yellow(summary);
}

/**
 * Format growth signals line.
 */
function formatGrowthLine(report: StateReport): string {
  const count = report.growth_signals.length;
  if (count === 0) {
    return chalk.dim('none detected');
  }
  return chalk.green(`${count} signals detected`);
}

/**
 * Produce a human-readable summary of a sensory cortex state report.
 */
export function formatSenseReport(report: StateReport, reportPath: string): string {
  const separator = chalk.dim('────────────────────────');
  const header = chalk.bold('🧠 Sensory Scan Complete');

  const lines = [
    header,
    separator,
    `Quality:      ${formatQualityLine(report)}`,
    `Performance:  ${formatPerformanceLine(report)}`,
    `Dependencies: ${formatDependenciesLine(report)}`,
    `Anomalies:    ${formatAnomaliesLine(report.anomalies)}`,
    `Growth:       ${formatGrowthLine(report)}`,
    '',
    `Full report: ${chalk.dim(reportPath)}`,
  ];

  return lines.join('\n');
}
