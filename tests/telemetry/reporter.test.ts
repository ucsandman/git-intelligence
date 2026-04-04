import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import type { TelemetryEvent } from '../../src/telemetry/types.js';
import { aggregateTelemetry } from '../../src/telemetry/reporter.js';

// ── fixture helper ─────────────────────────────────────────────────

function makeEvent(
  command: string,
  flags: string[] = [],
  exitCode = 0,
  timestampOffset = 0,
  executionMs = 300,
): TelemetryEvent {
  return {
    event_id: crypto.randomUUID(),
    timestamp: new Date(Date.now() - timestampOffset).toISOString(),
    giti_version: '0.1.0',
    node_version: 'v18.0.0',
    os_platform: 'linux',
    command,
    flags_used: flags,
    execution_time_ms: executionMs,
    exit_code: exitCode,
    repo_characteristics: {
      commit_count_bucket: '100-1k',
      branch_count_bucket: '0-5',
      author_count_bucket: '2-5',
      primary_language: 'TypeScript',
      has_monorepo_structure: false,
      age_bucket: '1-6mo',
    },
  };
}

// ── aggregateTelemetry ─────────────────────────────────────────────

describe('aggregateTelemetry', () => {
  it('returns all-zero aggregate for empty events', () => {
    const result = aggregateTelemetry([]);

    expect(result.total_events).toBe(0);
    expect(result.period_days).toBe(0);
    expect(result.command_frequency).toEqual({});
    expect(result.flag_frequency).toEqual({});
    expect(result.error_rate_by_command).toEqual({});
    expect(result.avg_execution_ms_by_command).toEqual({});
    expect(result.repo_size_distribution).toEqual({});
    expect(result.usage_sequences).toEqual([]);
    expect(result.json_usage_percent).toBe(0);
  });

  it('counts command frequency correctly', () => {
    const events = [
      makeEvent('pulse'),
      makeEvent('pulse'),
      makeEvent('hotspots'),
      makeEvent('pulse'),
      makeEvent('ghosts'),
    ];

    const result = aggregateTelemetry(events);

    expect(result.command_frequency).toEqual({
      pulse: 3,
      hotspots: 1,
      ghosts: 1,
    });
    expect(result.total_events).toBe(5);
  });

  it('calculates error rate per command', () => {
    const events = [
      makeEvent('pulse', [], 0),    // success
      makeEvent('pulse', [], 1),    // error
      makeEvent('pulse', [], 0),    // success
      makeEvent('hotspots', [], 1), // error
    ];

    const result = aggregateTelemetry(events);

    // pulse: 1 error / 3 total ≈ 0.333
    expect(result.error_rate_by_command['pulse']).toBeCloseTo(1 / 3, 5);
    // hotspots: 1 error / 1 total = 1.0
    expect(result.error_rate_by_command['hotspots']).toBe(1);
  });

  it('calculates average execution time per command', () => {
    const events = [
      makeEvent('pulse', [], 0, 0, 100),
      makeEvent('pulse', [], 0, 0, 300),
      makeEvent('hotspots', [], 0, 0, 500),
    ];

    const result = aggregateTelemetry(events);

    // pulse: (100 + 300) / 2 = 200
    expect(result.avg_execution_ms_by_command['pulse']).toBe(200);
    // hotspots: 500 / 1 = 500
    expect(result.avg_execution_ms_by_command['hotspots']).toBe(500);
  });

  it('calculates JSON usage percentage', () => {
    const events = [
      makeEvent('pulse', ['--json']),
      makeEvent('pulse', []),
      makeEvent('hotspots', ['--json', '--period=30d']),
      makeEvent('ghosts', []),
    ];

    const result = aggregateTelemetry(events);

    // 2 events with --json out of 4 total = 50%
    expect(result.json_usage_percent).toBe(50);
  });

  it('buckets repo size distribution', () => {
    const small = makeEvent('pulse');
    small.repo_characteristics.commit_count_bucket = '0-100';

    const medium1 = makeEvent('pulse');
    medium1.repo_characteristics.commit_count_bucket = '100-1k';

    const medium2 = makeEvent('hotspots');
    medium2.repo_characteristics.commit_count_bucket = '100-1k';

    const large = makeEvent('ghosts');
    large.repo_characteristics.commit_count_bucket = '1k-10k';

    const result = aggregateTelemetry([small, medium1, medium2, large]);

    expect(result.repo_size_distribution).toEqual({
      '0-100': 1,
      '100-1k': 2,
      '1k-10k': 1,
    });
  });

  it('detects sequences: two events within 60s grouped together', () => {
    const now = Date.now();
    const events = [
      { ...makeEvent('pulse'), timestamp: new Date(now - 30_000).toISOString() },
      { ...makeEvent('hotspots'), timestamp: new Date(now).toISOString() },
    ];

    const result = aggregateTelemetry(events);

    expect(result.usage_sequences).toHaveLength(1);
    expect(result.usage_sequences[0]!.commands).toEqual(['pulse', 'hotspots']);
    expect(result.usage_sequences[0]!.count).toBe(1);
  });

  it('separates events >60s apart into different sessions', () => {
    const now = Date.now();
    const events = [
      { ...makeEvent('pulse'), timestamp: new Date(now - 120_000).toISOString() },
      { ...makeEvent('hotspots'), timestamp: new Date(now).toISOString() },
    ];

    const result = aggregateTelemetry(events);

    // Each event is a single-command session, so no sequences
    expect(result.usage_sequences).toHaveLength(0);
  });

  it('does not include single-command sessions in sequences', () => {
    const now = Date.now();
    const events = [
      { ...makeEvent('pulse'), timestamp: new Date(now - 200_000).toISOString() },
      { ...makeEvent('hotspots'), timestamp: new Date(now - 100_000).toISOString() },
      { ...makeEvent('ghosts'), timestamp: new Date(now).toISOString() },
    ];

    // Each event is >60s apart from the next, forming 3 single-command sessions
    const result = aggregateTelemetry(events);

    expect(result.usage_sequences).toHaveLength(0);
  });

  it('calculates period days from timestamp range', () => {
    const now = Date.now();
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;

    const events = [
      { ...makeEvent('pulse'), timestamp: new Date(tenDaysAgo).toISOString() },
      { ...makeEvent('hotspots'), timestamp: new Date(now).toISOString() },
    ];

    const result = aggregateTelemetry(events);

    expect(result.period_days).toBe(10);
  });

  it('returns period_days of at least 1 for events on the same day', () => {
    const events = [
      makeEvent('pulse', [], 0, 0),
      makeEvent('hotspots', [], 0, 0),
    ];

    const result = aggregateTelemetry(events);

    expect(result.period_days).toBeGreaterThanOrEqual(1);
  });

  it('counts flag frequency correctly', () => {
    const events = [
      makeEvent('pulse', ['--json', '--period=30d']),
      makeEvent('hotspots', ['--json']),
      makeEvent('ghosts', ['--verbose', '--period=7d']),
    ];

    const result = aggregateTelemetry(events);

    expect(result.flag_frequency['--json']).toBe(2);
    expect(result.flag_frequency['--period']).toBe(2);
    expect(result.flag_frequency['--verbose']).toBe(1);
  });

  it('counts duplicate sequences', () => {
    const now = Date.now();
    // Session 1: pulse → hotspots
    const s1e1 = { ...makeEvent('pulse'), timestamp: new Date(now - 300_000).toISOString() };
    const s1e2 = { ...makeEvent('hotspots'), timestamp: new Date(now - 280_000).toISOString() };
    // Session 2: pulse → hotspots (same sequence, different time)
    const s2e1 = { ...makeEvent('pulse'), timestamp: new Date(now - 100_000).toISOString() };
    const s2e2 = { ...makeEvent('hotspots'), timestamp: new Date(now - 80_000).toISOString() };

    const result = aggregateTelemetry([s1e1, s1e2, s2e1, s2e2]);

    expect(result.usage_sequences).toHaveLength(1);
    expect(result.usage_sequences[0]!.commands).toEqual(['pulse', 'hotspots']);
    expect(result.usage_sequences[0]!.count).toBe(2);
  });

  it('sorts sequences by count descending', () => {
    const now = Date.now();
    // 1x ghosts → pulse
    const a1 = { ...makeEvent('ghosts'), timestamp: new Date(now - 500_000).toISOString() };
    const a2 = { ...makeEvent('pulse'), timestamp: new Date(now - 490_000).toISOString() };
    // 2x pulse → hotspots
    const b1 = { ...makeEvent('pulse'), timestamp: new Date(now - 300_000).toISOString() };
    const b2 = { ...makeEvent('hotspots'), timestamp: new Date(now - 290_000).toISOString() };
    const c1 = { ...makeEvent('pulse'), timestamp: new Date(now - 100_000).toISOString() };
    const c2 = { ...makeEvent('hotspots'), timestamp: new Date(now - 90_000).toISOString() };

    const result = aggregateTelemetry([a1, a2, b1, b2, c1, c2]);

    expect(result.usage_sequences[0]!.commands).toEqual(['pulse', 'hotspots']);
    expect(result.usage_sequences[0]!.count).toBe(2);
    expect(result.usage_sequences[1]!.commands).toEqual(['ghosts', 'pulse']);
    expect(result.usage_sequences[1]!.count).toBe(1);
  });
});
