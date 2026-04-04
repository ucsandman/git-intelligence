import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { StateReport } from '../../../src/agents/sensory-cortex/types.js';
import type { CycleResult } from '../../../src/agents/orchestrator/types.js';
import type { CyclePlan, WorkItem } from '../../../src/agents/prefrontal-cortex/types.js';
import type { KnowledgeBase } from '../../../src/agents/memory/types.js';
import type { OrganismEvent } from '../../../src/agents/types.js';
import { buildDashClawReport, pushReport } from '../../../src/integrations/dashclaw/reporter.js';
import { getDashboardConfig } from '../../../src/integrations/dashclaw/config.js';

// ── helpers ─────────────────────────────────────────────────────────────

function makeReport(overrides: {
  test_coverage_percent?: number;
  lint_error_count?: number;
  pulse_execution_ms?: number;
  hotspots_execution_ms?: number;
  ghosts_execution_ms?: number;
  vulnerable_count?: number;
  outdated_count?: number;
  total_files?: number;
  total_lines?: number;
  avg_file_length?: number;
  commits_last_7d?: number;
} = {}): StateReport {
  return {
    timestamp: '2026-04-04T00:00:00Z',
    version: '1.0.0',
    git: {
      total_commits: 100,
      commits_last_7d: overrides.commits_last_7d ?? 10,
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
      test_coverage_percent: overrides.test_coverage_percent ?? 85,
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
      total_files: overrides.total_files ?? 50,
      total_lines: overrides.total_lines ?? 5000,
      avg_file_length: overrides.avg_file_length ?? 100,
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

function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: overrides.id ?? 'wi-1',
    tier: overrides.tier ?? 1,
    priority_score: overrides.priority_score ?? 80,
    title: overrides.title ?? 'Fix lint errors',
    description: overrides.description ?? 'Fix all remaining lint errors',
    rationale: overrides.rationale ?? 'Clean codebase',
    target_files: overrides.target_files ?? ['src/index.ts'],
    estimated_complexity: overrides.estimated_complexity ?? 'small',
    memory_context: overrides.memory_context ?? [],
    success_criteria: overrides.success_criteria ?? ['No lint errors'],
    created_by: overrides.created_by ?? 'prefrontal-cortex',
    status: overrides.status ?? 'planned',
  };
}

function makePlan(overrides: Partial<CyclePlan> = {}): CyclePlan {
  return {
    cycle_number: overrides.cycle_number ?? 5,
    timestamp: overrides.timestamp ?? '2026-04-04T00:00:00Z',
    state_report_id: overrides.state_report_id ?? 'sr-1',
    selected_items: overrides.selected_items ?? [makeWorkItem(), makeWorkItem({ id: 'wi-2', title: 'Add tests' })],
    deferred_items: overrides.deferred_items ?? [],
    rationale: overrides.rationale ?? 'High priority items',
    estimated_risk: overrides.estimated_risk ?? 'low',
    memory_consulted: overrides.memory_consulted ?? true,
  };
}

function makeEvent(overrides: Partial<OrganismEvent> = {}): OrganismEvent {
  return {
    id: overrides.id ?? 'evt-1',
    timestamp: overrides.timestamp ?? '2026-04-04T00:00:00Z',
    cycle: overrides.cycle ?? 5,
    type: overrides.type ?? 'change-merged',
    agent: overrides.agent ?? 'motor-cortex',
    summary: overrides.summary ?? 'Merged fix for lint errors',
    data: overrides.data ?? { outcome: 'success' },
    tags: overrides.tags ?? [],
  };
}

function makeKnowledgeBase(overrides: Partial<KnowledgeBase> = {}): KnowledgeBase {
  return {
    created: overrides.created ?? '2026-03-01T00:00:00Z',
    last_updated: overrides.last_updated ?? '2026-04-04T00:00:00Z',
    cycle_count: overrides.cycle_count ?? 5,
    events: overrides.events ?? [
      makeEvent({ id: 'evt-1', cycle: 5, type: 'change-merged', agent: 'motor-cortex', summary: 'Merged lint fix' }),
      makeEvent({ id: 'evt-2', cycle: 5, type: 'plan-created', agent: 'prefrontal-cortex', summary: 'Created cycle plan' }),
      makeEvent({ id: 'evt-3', cycle: 4, type: 'change-merged', agent: 'motor-cortex', summary: 'Old cycle event' }),
      makeEvent({ id: 'evt-4', cycle: 5, type: 'growth-approved', agent: 'growth-hormone', summary: 'Approved new feature', data: { outcome: 'shipped' } }),
    ],
    lessons: overrides.lessons ?? [
      { id: 'l-1', learned_at: '2026-03-15T00:00:00Z', lesson: 'Always run lint before merge', evidence_event_ids: ['evt-1'], confidence: 0.95, category: 'quality', times_referenced: 5 },
      { id: 'l-2', learned_at: '2026-03-20T00:00:00Z', lesson: 'Test coverage prevents regressions', evidence_event_ids: ['evt-2'], confidence: 0.9, category: 'testing', times_referenced: 3 },
      { id: 'l-3', learned_at: '2026-03-25T00:00:00Z', lesson: 'Small changes merge faster', evidence_event_ids: ['evt-3'], confidence: 0.85, category: 'architecture', times_referenced: 2 },
    ],
    patterns: overrides.patterns ?? {
      fragile_files: [],
      rejection_reasons: {},
      successful_change_types: {},
      failed_change_types: {},
    },
    preferences: overrides.preferences ?? [
      { preference: 'Prefers small atomic changes', evidence_count: 5, first_observed: '2026-03-10T00:00:00Z', last_observed: '2026-04-01T00:00:00Z' },
      { preference: 'Avoids large refactors', evidence_count: 3, first_observed: '2026-03-15T00:00:00Z', last_observed: '2026-04-02T00:00:00Z' },
    ],
  };
}

// ── buildDashClawReport ─────────────────────────────────────────────────

describe('buildDashClawReport', () => {
  it('produces all required top-level fields', () => {
    const cycleResult = makeCycleResult({ cycle: 5 });
    const stateReport = makeReport();
    const plan = makePlan();
    const history = [makeCycleResult({ cycle: 1 }), makeCycleResult({ cycle: 2 })];
    const kb = makeKnowledgeBase();

    const report = buildDashClawReport({
      cycleResult,
      stateReport,
      plan,
      history,
      kb,
      version: '1.0.0',
    });

    expect(report).toHaveProperty('cycle_number', 5);
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('organism_version', '1.0.0');
    expect(report).toHaveProperty('vital_signs');
    expect(report).toHaveProperty('cycle_summary');
    expect(report).toHaveProperty('decisions');
    expect(report).toHaveProperty('evolutionary_state');
  });

  it('vital_signs fitness_score is a number 0-100', () => {
    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport: makeReport(),
      plan: makePlan(),
      history: [makeCycleResult()],
      kb: makeKnowledgeBase(),
      version: '1.0.0',
    });

    expect(typeof report.vital_signs.fitness_score).toBe('number');
    expect(report.vital_signs.fitness_score).toBeGreaterThanOrEqual(0);
    expect(report.vital_signs.fitness_score).toBeLessThanOrEqual(100);
  });

  it('vital_signs contains all required fields', () => {
    const stateReport = makeReport({
      test_coverage_percent: 75,
      lint_error_count: 2,
      avg_file_length: 120,
      pulse_execution_ms: 300,
      hotspots_execution_ms: 400,
      ghosts_execution_ms: 500,
      commits_last_7d: 8,
    });

    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport,
      plan: makePlan(),
      history: [],
      kb: null,
      version: '1.0.0',
    });

    const vs = report.vital_signs;
    expect(vs.test_coverage).toBe(75);
    expect(vs.lint_errors).toBe(2);
    expect(vs.complexity_avg).toBe(120);
    expect(vs.performance).toEqual({ pulse: 300, hotspots: 400, ghosts: 500 });
    expect(typeof vs.dependency_health).toBe('number');
    expect(vs.commit_velocity_7d).toBe(8);
    expect(typeof vs.mutation_success_rate).toBe('number');
    expect(typeof vs.regression_rate).toBe('number');
  });

  it('cycle_summary fields match the CycleResult input', () => {
    const cycleResult = makeCycleResult({
      cycle: 5,
      outcome: 'productive',
      changes_attempted: 4,
      changes_approved: 3,
      changes_merged: 2,
      api_tokens_used: 2500,
    });

    const plan = makePlan({
      selected_items: [makeWorkItem(), makeWorkItem({ id: 'wi-2' }), makeWorkItem({ id: 'wi-3' })],
    });

    const report = buildDashClawReport({
      cycleResult,
      stateReport: makeReport(),
      plan,
      history: [],
      kb: null,
      version: '1.0.0',
    });

    expect(report.cycle_summary.outcome).toBe('productive');
    expect(report.cycle_summary.items_planned).toBe(3);
    expect(report.cycle_summary.items_implemented).toBe(4);
    expect(report.cycle_summary.items_approved).toBe(3);
    expect(report.cycle_summary.items_merged).toBe(2);
    expect(report.cycle_summary.api_tokens_used).toBe(2500);
  });

  it('cycle_summary.items_planned is 0 when plan is null', () => {
    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb: null,
      version: '1.0.0',
    });

    expect(report.cycle_summary.items_planned).toBe(0);
  });

  it('decisions extracted from KB events for the correct cycle', () => {
    const kb = makeKnowledgeBase({
      events: [
        makeEvent({ id: 'evt-1', cycle: 5, type: 'change-merged', agent: 'motor-cortex', summary: 'Merged lint fix', data: { outcome: 'success' } }),
        makeEvent({ id: 'evt-2', cycle: 5, type: 'plan-created', agent: 'prefrontal-cortex', summary: 'Created plan', data: {} }),
        makeEvent({ id: 'evt-3', cycle: 4, type: 'change-merged', agent: 'motor-cortex', summary: 'Old event' }),
      ],
    });

    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport: makeReport(),
      plan: makePlan(),
      history: [],
      kb,
      version: '1.0.0',
    });

    // Only cycle 5 events should be included
    expect(report.decisions).toHaveLength(2);
    expect(report.decisions[0]!.agent).toBe('motor-cortex');
    expect(report.decisions[0]!.action).toBe('change-merged');
    expect(report.decisions[0]!.reasoning).toBe('Merged lint fix');
    expect(report.decisions[0]!.outcome).toBe('success');
    expect(report.decisions[1]!.agent).toBe('prefrontal-cortex');
    expect(report.decisions[1]!.action).toBe('plan-created');
  });

  it('decisions is empty when kb is null', () => {
    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb: null,
      version: '1.0.0',
    });

    expect(report.decisions).toEqual([]);
  });

  it('decisions falls back to event type when outcome not in data', () => {
    const kb = makeKnowledgeBase({
      events: [
        makeEvent({ id: 'evt-1', cycle: 5, type: 'plan-created', agent: 'prefrontal-cortex', summary: 'Created plan', data: {} }),
      ],
    });

    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb,
      version: '1.0.0',
    });

    expect(report.decisions[0]!.outcome).toBe('plan-created');
  });

  it('evolutionary_state includes correct totals from history', () => {
    const history = [
      makeCycleResult({ cycle: 1, changes_merged: 3, changes_rejected: 1 }),
      makeCycleResult({ cycle: 2, changes_merged: 5, changes_rejected: 2 }),
      makeCycleResult({ cycle: 3, changes_merged: 2, changes_rejected: 0 }),
    ];
    const currentCycle = makeCycleResult({ cycle: 4, changes_merged: 4, changes_rejected: 1 });

    const kb = makeKnowledgeBase({
      created: '2026-01-01T00:00:00Z',
      events: [
        makeEvent({ type: 'growth-approved', cycle: 1 }),
        makeEvent({ type: 'growth-approved', cycle: 2 }),
        makeEvent({ type: 'change-merged', cycle: 3 }),
      ],
    });

    const report = buildDashClawReport({
      cycleResult: currentCycle,
      stateReport: makeReport({ total_files: 60, total_lines: 8000 }),
      plan: makePlan(),
      history,
      kb,
      version: '2.0.0',
    });

    const evo = report.evolutionary_state;
    expect(evo.total_cycles).toBe(4); // 3 history + 1 current
    expect(evo.total_changes_merged).toBe(14); // 3+5+2+4
    expect(evo.total_changes_rejected).toBe(4); // 1+2+0+1
    expect(evo.total_files).toBe(60);
    expect(evo.total_lines).toBe(8000);
    expect(evo.organism_born).toBe('2026-01-01T00:00:00Z');
    expect(evo.growth_features_shipped).toBe(2); // 2 growth-approved events
    expect(evo.total_commands).toBe(14);
    expect(evo.commands_list).toHaveLength(14);
  });

  it('evolutionary_state uses defaults when kb is null', () => {
    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 1 }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb: null,
      version: '1.0.0',
    });

    const evo = report.evolutionary_state;
    expect(evo.organism_born).toBeTruthy();
    expect(evo.growth_features_shipped).toBe(0);
    expect(evo.emerged_preferences).toEqual([]);
    expect(evo.top_lessons).toEqual([]);
  });

  it('evolutionary_state emerged_preferences from KB', () => {
    const kb = makeKnowledgeBase();

    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb,
      version: '1.0.0',
    });

    expect(report.evolutionary_state.emerged_preferences).toEqual([
      'Prefers small atomic changes',
      'Avoids large refactors',
    ]);
  });

  it('evolutionary_state top_lessons sorted by confidence descending, max 5', () => {
    const kb = makeKnowledgeBase({
      lessons: [
        { id: 'l-1', learned_at: '2026-03-01T00:00:00Z', lesson: 'Lesson A', evidence_event_ids: [], confidence: 0.5, category: 'quality', times_referenced: 1 },
        { id: 'l-2', learned_at: '2026-03-02T00:00:00Z', lesson: 'Lesson B', evidence_event_ids: [], confidence: 0.99, category: 'testing', times_referenced: 1 },
        { id: 'l-3', learned_at: '2026-03-03T00:00:00Z', lesson: 'Lesson C', evidence_event_ids: [], confidence: 0.8, category: 'architecture', times_referenced: 1 },
        { id: 'l-4', learned_at: '2026-03-04T00:00:00Z', lesson: 'Lesson D', evidence_event_ids: [], confidence: 0.7, category: 'performance', times_referenced: 1 },
        { id: 'l-5', learned_at: '2026-03-05T00:00:00Z', lesson: 'Lesson E', evidence_event_ids: [], confidence: 0.6, category: 'dependencies', times_referenced: 1 },
        { id: 'l-6', learned_at: '2026-03-06T00:00:00Z', lesson: 'Lesson F', evidence_event_ids: [], confidence: 0.3, category: 'growth', times_referenced: 1 },
      ],
    });

    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb,
      version: '1.0.0',
    });

    expect(report.evolutionary_state.top_lessons).toHaveLength(5);
    expect(report.evolutionary_state.top_lessons[0]).toBe('Lesson B'); // highest confidence (0.99)
    expect(report.evolutionary_state.top_lessons[1]).toBe('Lesson C'); // 0.8
    expect(report.evolutionary_state.top_lessons[4]).toBe('Lesson A'); // 5th highest (0.5), Lesson F (0.3) excluded
  });
});

// ── pushReport ──────────────────────────────────────────────────────────

describe('pushReport', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dashclaw-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes file to .organism/dashclaw-reports/', async () => {
    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 5 }),
      stateReport: makeReport(),
      plan: makePlan(),
      history: [],
      kb: null,
      version: '1.0.0',
    });

    const filePath = await pushReport(report, tmpDir);

    expect(filePath).toContain('dashclaw-reports');
    expect(filePath).toContain('cycle-5');

    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('written file is valid JSON matching the report', async () => {
    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 3, outcome: 'stable' }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb: null,
      version: '2.0.0',
    });

    const filePath = await pushReport(report, tmpDir);
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.cycle_number).toBe(3);
    expect(parsed.organism_version).toBe('2.0.0');
    expect(parsed.cycle_summary.outcome).toBe('stable');
    expect(parsed.vital_signs).toBeDefined();
    expect(parsed.evolutionary_state).toBeDefined();
  });

  it('falls through to local write when config has api_key and endpoint', async () => {
    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 1 }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb: null,
      version: '1.0.0',
    });

    // For now, even with config, it falls through to local write
    const filePath = await pushReport(report, tmpDir, {
      api_key: 'test-key',
      endpoint: 'https://dashclaw.example.com',
    });

    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('creates dashclaw-reports directory if it does not exist', async () => {
    const report = buildDashClawReport({
      cycleResult: makeCycleResult({ cycle: 7 }),
      stateReport: makeReport(),
      plan: null,
      history: [],
      kb: null,
      version: '1.0.0',
    });

    const filePath = await pushReport(report, tmpDir);
    const dir = path.dirname(filePath);
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });
});

// ── getDashboardConfig ──────────────────────────────────────────────────

describe('getDashboardConfig', () => {
  it('returns 6 panels', () => {
    const panels = getDashboardConfig();
    expect(panels).toHaveLength(6);
  });

  it('each panel has required fields', () => {
    const panels = getDashboardConfig();
    for (const panel of panels) {
      expect(panel).toHaveProperty('id');
      expect(panel).toHaveProperty('title');
      expect(panel).toHaveProperty('type');
      expect(panel).toHaveProperty('description');
      expect(panel).toHaveProperty('data_source');
      expect(typeof panel.id).toBe('string');
      expect(typeof panel.title).toBe('string');
      expect(typeof panel.description).toBe('string');
      expect(typeof panel.data_source).toBe('string');
    }
  });

  it('panel IDs are unique', () => {
    const panels = getDashboardConfig();
    const ids = panels.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes expected panel types', () => {
    const panels = getDashboardConfig();
    const types = panels.map(p => p.type);
    expect(types).toContain('gauge');
    expect(types).toContain('timeline');
    expect(types).toContain('treemap');
    expect(types).toContain('table');
    expect(types).toContain('cards');
    expect(types).toContain('text');
  });
});
