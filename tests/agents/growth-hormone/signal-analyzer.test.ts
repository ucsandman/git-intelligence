import type { TelemetryAggregate } from '../../../src/telemetry/reporter.js';
import type { OrganismConfig } from '../../../src/agents/types.js';
import { analyzeSignals } from '../../../src/agents/growth-hormone/signal-analyzer.js';

// ── shared fixtures ────────────────────────────────────────────────

function makeAggregate(
  overrides: Partial<TelemetryAggregate> = {},
): TelemetryAggregate {
  return {
    total_events: 100,
    period_days: 30,
    command_frequency: { pulse: 40, hotspots: 35, ghosts: 25 },
    flag_frequency: { '--json': 3, '--since': 10 },
    error_rate_by_command: { pulse: 0.01, hotspots: 0.02, ghosts: 0.01 },
    avg_execution_ms_by_command: { pulse: 300, hotspots: 1200, ghosts: 800 },
    repo_size_distribution: { '0-100': 30, '100-1k': 50, '1k-10k': 20 },
    usage_sequences: [],
    json_usage_percent: 3,
    ...overrides,
  };
}

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
  boundaries: {
    growth_zone: ['new-analysis-commands', 'output-formatters'],
    forbidden_zone: ['git-write-operations'],
  },
  lifecycle: {
    cycle_frequency: 'daily',
    max_changes_per_cycle: 3,
    mandatory_cooldown_after_regression: '48 hours',
    branch_naming: 'organism/{cortex}/{description}',
    requires_immune_approval: true,
  },
};

// ── usage concentration ────────────────────────────────────────────

describe('analyzeSignals – usage concentration', () => {
  it('detects concentration when one command has >50% of invocations', () => {
    const agg = makeAggregate({
      total_events: 100,
      command_frequency: { pulse: 60, hotspots: 25, ghosts: 15 },
    });
    const signals = analyzeSignals(agg, mockConfig);
    const conc = signals.find((s) => s.type === 'usage-concentration');
    expect(conc).toBeDefined();
    expect(conc!.title).toContain('pulse');
    expect(conc!.title).toContain('60%');
    expect(conc!.confidence).toBeGreaterThan(0);
    expect(conc!.confidence).toBeLessThanOrEqual(0.95);
  });

  it('does NOT detect concentration when commands are evenly split', () => {
    const agg = makeAggregate({
      total_events: 90,
      command_frequency: { pulse: 30, hotspots: 30, ghosts: 30 },
    });
    const signals = analyzeSignals(agg, mockConfig);
    const conc = signals.find((s) => s.type === 'usage-concentration');
    expect(conc).toBeUndefined();
  });
});

// ── usage sequences ────────────────────────────────────────────────

describe('analyzeSignals – usage sequences', () => {
  it('detects usage sequences when count >= 5', () => {
    const agg = makeAggregate({
      usage_sequences: [
        { commands: ['pulse', 'hotspots'], count: 8 },
        { commands: ['ghosts', 'pulse'], count: 3 },
      ],
    });
    const signals = analyzeSignals(agg, mockConfig);
    const seqs = signals.filter((s) => s.type === 'usage-sequence');
    expect(seqs).toHaveLength(1);
    expect(seqs[0]!.title).toContain('pulse');
    expect(seqs[0]!.title).toContain('hotspots');
    expect(seqs[0]!.confidence).toBeGreaterThan(0);
    expect(seqs[0]!.confidence).toBeLessThanOrEqual(0.9);
  });

  it('does NOT detect sequences with count < 5', () => {
    const agg = makeAggregate({
      usage_sequences: [{ commands: ['pulse', 'hotspots'], count: 4 }],
    });
    const signals = analyzeSignals(agg, mockConfig);
    const seqs = signals.filter((s) => s.type === 'usage-sequence');
    expect(seqs).toHaveLength(0);
  });
});

// ── error patterns ─────────────────────────────────────────────────

describe('analyzeSignals – error patterns', () => {
  it('detects error patterns when error rate > 5%', () => {
    const agg = makeAggregate({
      error_rate_by_command: { pulse: 0.01, hotspots: 0.12, ghosts: 0.01 },
    });
    const signals = analyzeSignals(agg, mockConfig);
    const errs = signals.filter((s) => s.type === 'error-pattern');
    expect(errs).toHaveLength(1);
    expect(errs[0]!.title).toContain('hotspots');
    expect(errs[0]!.title).toContain('12%');
    expect(errs[0]!.confidence).toBeGreaterThan(0);
    expect(errs[0]!.confidence).toBeLessThanOrEqual(0.85);
  });

  it('does NOT detect errors when all rates <= 5%', () => {
    const agg = makeAggregate({
      error_rate_by_command: { pulse: 0.01, hotspots: 0.05, ghosts: 0.03 },
    });
    const signals = analyzeSignals(agg, mockConfig);
    const errs = signals.filter((s) => s.type === 'error-pattern');
    expect(errs).toHaveLength(0);
  });
});

// ── flag underuse ──────────────────────────────────────────────────

describe('analyzeSignals – flag underuse', () => {
  it('detects flag underuse when json < 5% and enough events', () => {
    const agg = makeAggregate({
      total_events: 100,
      json_usage_percent: 3,
    });
    const signals = analyzeSignals(agg, mockConfig);
    const flagSig = signals.find((s) => s.type === 'flag-pattern');
    expect(flagSig).toBeDefined();
    expect(flagSig!.title).toContain('--json');
    expect(flagSig!.confidence).toBe(0.4);
  });

  it('does NOT flag underuse with < 50 events', () => {
    const agg = makeAggregate({
      total_events: 40,
      json_usage_percent: 2,
    });
    const signals = analyzeSignals(agg, mockConfig);
    const flagSig = signals.find((s) => s.type === 'flag-pattern');
    expect(flagSig).toBeUndefined();
  });
});

// ── large repo missing capability ──────────────────────────────────

describe('analyzeSignals – large repo missing capability', () => {
  it('detects large repo support needs when >10% events in large buckets', () => {
    const agg = makeAggregate({
      total_events: 100,
      repo_size_distribution: {
        '0-100': 20,
        '100-1k': 30,
        '1k-10k': 30,
        '10k-100k': 12,
        '100k+': 8,
      },
      error_rate_by_command: { pulse: 0.01, hotspots: 0.02, ghosts: 0.01 },
    });
    const signals = analyzeSignals(agg, mockConfig);
    const large = signals.find((s) => s.type === 'missing-capability');
    expect(large).toBeDefined();
    expect(large!.title).toContain('Large repo');
    expect(large!.confidence).toBe(0.6);
  });
});

// ── sorting and limits ─────────────────────────────────────────────

describe('analyzeSignals – sorting and limits', () => {
  it('returns max 6 signals', () => {
    const agg = makeAggregate({
      total_events: 200,
      command_frequency: { pulse: 120, hotspots: 50, ghosts: 30 },
      usage_sequences: [
        { commands: ['pulse', 'hotspots'], count: 10 },
        { commands: ['ghosts', 'pulse'], count: 7 },
        { commands: ['hotspots', 'ghosts'], count: 6 },
      ],
      error_rate_by_command: { pulse: 0.15, hotspots: 0.10, ghosts: 0.08 },
      json_usage_percent: 2,
      repo_size_distribution: {
        '0-100': 50,
        '100-1k': 80,
        '1k-10k': 40,
        '10k-100k': 20,
        '100k+': 10,
      },
    });
    const signals = analyzeSignals(agg, mockConfig);
    expect(signals.length).toBeLessThanOrEqual(6);
  });

  it('signals are sorted by confidence descending', () => {
    const agg = makeAggregate({
      total_events: 200,
      command_frequency: { pulse: 120, hotspots: 50, ghosts: 30 },
      usage_sequences: [
        { commands: ['pulse', 'hotspots'], count: 10 },
      ],
      error_rate_by_command: { pulse: 0.15, hotspots: 0.10, ghosts: 0.01 },
      json_usage_percent: 2,
    });
    const signals = analyzeSignals(agg, mockConfig);
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i]!.confidence).toBeLessThanOrEqual(
        signals[i - 1]!.confidence,
      );
    }
  });
});

// ── signal shape ───────────────────────────────────────────────────

describe('analyzeSignals – signal shape', () => {
  it('each signal has correct type, title, evidence, and data fields', () => {
    const agg = makeAggregate({
      total_events: 100,
      command_frequency: { pulse: 60, hotspots: 25, ghosts: 15 },
      error_rate_by_command: { pulse: 0.01, hotspots: 0.10, ghosts: 0.01 },
      usage_sequences: [{ commands: ['pulse', 'hotspots'], count: 6 }],
      json_usage_percent: 2,
    });
    const signals = analyzeSignals(agg, mockConfig);
    expect(signals.length).toBeGreaterThan(0);

    for (const signal of signals) {
      expect(signal).toHaveProperty('type');
      expect(signal).toHaveProperty('title');
      expect(signal).toHaveProperty('evidence');
      expect(signal).toHaveProperty('confidence');
      expect(signal).toHaveProperty('data');
      expect(typeof signal.type).toBe('string');
      expect(typeof signal.title).toBe('string');
      expect(typeof signal.evidence).toBe('string');
      expect(typeof signal.confidence).toBe('number');
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.confidence).toBeLessThanOrEqual(1);
      expect(typeof signal.data).toBe('object');
      expect(signal.data).not.toBeNull();
    }
  });
});
