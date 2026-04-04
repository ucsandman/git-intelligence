import type { GrowthSignal } from './types.js';
import type { TelemetryAggregate } from '../../telemetry/reporter.js';
import type { OrganismConfig } from '../types.js';

/**
 * Analyze telemetry data for growth opportunity signals.
 * Returns the top 6 signals sorted by confidence descending.
 */
export function analyzeSignals(
  aggregate: TelemetryAggregate,
  _config: OrganismConfig,
): GrowthSignal[] {
  const signals: GrowthSignal[] = [];

  detectUsageConcentration(aggregate, signals);
  detectUsageSequences(aggregate, signals);
  detectErrorPatterns(aggregate, signals);
  detectFlagUnderuse(aggregate, signals);
  detectLargeRepoStruggle(aggregate, signals);

  signals.sort((a, b) => b.confidence - a.confidence);

  return signals.slice(0, 6);
}

function detectUsageConcentration(
  aggregate: TelemetryAggregate,
  signals: GrowthSignal[],
): void {
  const { command_frequency, total_events } = aggregate;
  if (total_events === 0) return;

  for (const [cmd, count] of Object.entries(command_frequency)) {
    const ratio = count / total_events;
    if (ratio > 0.5) {
      const pct = Math.round(ratio * 100);
      signals.push({
        type: 'usage-concentration',
        title: `${cmd} dominates usage at ${pct}%`,
        evidence: `${cmd} accounts for ${count}/${total_events} invocations (${pct}%)`,
        confidence: Math.min(ratio, 0.95),
        data: { command: cmd, count, total: total_events, ratio },
      });
    }
  }
}

function detectUsageSequences(
  aggregate: TelemetryAggregate,
  signals: GrowthSignal[],
): void {
  for (const seq of aggregate.usage_sequences) {
    if (seq.count >= 5) {
      const label = seq.commands.join(' \u2192 ');
      signals.push({
        type: 'usage-sequence',
        title: `Users frequently run ${label}`,
        evidence: `Sequence ${label} observed ${seq.count} times`,
        confidence: Math.min(seq.count / 20, 0.9),
        data: { commands: seq.commands, count: seq.count },
      });
    }
  }
}

function detectErrorPatterns(
  aggregate: TelemetryAggregate,
  signals: GrowthSignal[],
): void {
  for (const [cmd, rate] of Object.entries(aggregate.error_rate_by_command)) {
    if (rate > 0.05) {
      const pct = Math.round(rate * 100);
      signals.push({
        type: 'error-pattern',
        title: `${cmd} has ${pct}% error rate`,
        evidence: `${cmd} fails ${pct}% of the time`,
        confidence: Math.min(rate * 5, 0.85),
        data: { command: cmd, error_rate: rate },
      });
    }
  }
}

function detectFlagUnderuse(
  aggregate: TelemetryAggregate,
  signals: GrowthSignal[],
): void {
  if (
    aggregate.json_usage_percent < 5 &&
    aggregate.total_events > 50
  ) {
    signals.push({
      type: 'flag-pattern',
      title: '--json flag rarely used',
      evidence: `--json used in only ${aggregate.json_usage_percent.toFixed(1)}% of invocations`,
      confidence: 0.4,
      data: { json_usage_percent: aggregate.json_usage_percent },
    });
  }
}

function detectLargeRepoStruggle(
  aggregate: TelemetryAggregate,
  signals: GrowthSignal[],
): void {
  const { repo_size_distribution, total_events } = aggregate;
  if (total_events === 0) return;

  const largeCount =
    (repo_size_distribution['10k-100k'] ?? 0) +
    (repo_size_distribution['100k+'] ?? 0);
  const largeRatio = largeCount / total_events;

  if (largeRatio > 0.1) {
    signals.push({
      type: 'missing-capability',
      title: 'Large repo support needs improvement',
      evidence: `${Math.round(largeRatio * 100)}% of events come from repos with 10k+ commits`,
      confidence: 0.6,
      data: { large_repo_events: largeCount, total_events, ratio: largeRatio },
    });
  }
}
