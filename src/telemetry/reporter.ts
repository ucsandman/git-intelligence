import type { TelemetryEvent } from './types.js';

export interface TelemetryAggregate {
  total_events: number;
  period_days: number;
  command_frequency: Record<string, number>;
  flag_frequency: Record<string, number>;
  error_rate_by_command: Record<string, number>;
  avg_execution_ms_by_command: Record<string, number>;
  repo_size_distribution: Record<string, number>;
  usage_sequences: Array<{ commands: string[]; count: number }>;
  json_usage_percent: number;
}

export function aggregateTelemetry(events: TelemetryEvent[]): TelemetryAggregate {
  if (events.length === 0) {
    return {
      total_events: 0,
      period_days: 0,
      command_frequency: {},
      flag_frequency: {},
      error_rate_by_command: {},
      avg_execution_ms_by_command: {},
      repo_size_distribution: {},
      usage_sequences: [],
      json_usage_percent: 0,
    };
  }

  // Command frequency
  const cmdFreq: Record<string, number> = {};
  const cmdErrors: Record<string, number> = {};
  const cmdTotal: Record<string, number> = {};
  const cmdTotalMs: Record<string, number> = {};
  const flagFreq: Record<string, number> = {};
  const sizeDistribution: Record<string, number> = {};
  let jsonCount = 0;

  for (const event of events) {
    cmdFreq[event.command] = (cmdFreq[event.command] ?? 0) + 1;
    cmdTotal[event.command] = (cmdTotal[event.command] ?? 0) + 1;
    cmdTotalMs[event.command] = (cmdTotalMs[event.command] ?? 0) + event.execution_time_ms;

    if (event.exit_code !== 0) {
      cmdErrors[event.command] = (cmdErrors[event.command] ?? 0) + 1;
    }

    for (const flag of event.flags_used) {
      const flagName = flag.split('=')[0]!;
      flagFreq[flagName] = (flagFreq[flagName] ?? 0) + 1;
      if (flagName === '--json') jsonCount++;
    }

    const bucket = event.repo_characteristics.commit_count_bucket;
    sizeDistribution[bucket] = (sizeDistribution[bucket] ?? 0) + 1;
  }

  // Error rates
  const errorRates: Record<string, number> = {};
  for (const [cmd, total] of Object.entries(cmdTotal)) {
    errorRates[cmd] = (cmdErrors[cmd] ?? 0) / total;
  }

  // Average execution time
  const avgMs: Record<string, number> = {};
  for (const [cmd, totalMs] of Object.entries(cmdTotalMs)) {
    avgMs[cmd] = Math.round(totalMs / (cmdTotal[cmd] ?? 1));
  }

  // Usage sequences: group events by timestamp proximity (<60s apart)
  const sequences = detectSequences(events);

  // Period in days
  const timestamps = events.map((e) => new Date(e.timestamp).getTime());
  const periodMs = Math.max(...timestamps) - Math.min(...timestamps);
  const periodDays = Math.max(1, Math.round(periodMs / (24 * 60 * 60 * 1000)));

  return {
    total_events: events.length,
    period_days: periodDays,
    command_frequency: cmdFreq,
    flag_frequency: flagFreq,
    error_rate_by_command: errorRates,
    avg_execution_ms_by_command: avgMs,
    repo_size_distribution: sizeDistribution,
    usage_sequences: sequences,
    json_usage_percent: (jsonCount / events.length) * 100,
  };
}

function detectSequences(
  events: TelemetryEvent[],
): Array<{ commands: string[]; count: number }> {
  // Sort by timestamp
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Group into sessions (events within 60s of each other)
  const sessions: string[][] = [];
  let currentSession: string[] = [];
  let lastTimestamp = 0;

  for (const event of sorted) {
    const ts = new Date(event.timestamp).getTime();
    if (currentSession.length === 0 || ts - lastTimestamp < 60_000) {
      currentSession.push(event.command);
    } else {
      if (currentSession.length > 1) sessions.push(currentSession);
      currentSession = [event.command];
    }
    lastTimestamp = ts;
  }
  if (currentSession.length > 1) sessions.push(currentSession);

  // Count unique multi-command sequences
  const seqCounts = new Map<string, { commands: string[]; count: number }>();
  for (const session of sessions) {
    const key = session.join(' \u2192 ');
    const existing = seqCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      seqCounts.set(key, { commands: session, count: 1 });
    }
  }

  return [...seqCounts.values()].sort((a, b) => b.count - a.count);
}
