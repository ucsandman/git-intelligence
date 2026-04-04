import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CycleResult } from '../../src/agents/orchestrator/types.js';
import type { StateReport } from '../../src/agents/sensory-cortex/types.js';
import type { KnowledgeBase } from '../../src/agents/memory/types.js';
import type { OrganismEvent } from '../../src/agents/types.js';

// Mock narrative module
vi.mock('../../src/content/narrative.js', () => ({
  generateNarrative: vi.fn().mockResolvedValue({
    headline: 'Test headline',
    narrative: 'Test narrative about the organism.',
    key_moments: [{ moment: 'Something happened', significance: 'It was significant' }],
    content_hooks: ['hook1'],
  }),
  generateFallbackNarrative: vi.fn().mockReturnValue({
    headline: 'Fallback headline',
    narrative: 'Fallback narrative.',
    key_moments: [],
    content_hooks: [],
  }),
}));

// Mock fitness calculation
vi.mock('../../src/integrations/dashclaw/fitness.js', () => ({
  calculateFitnessScore: vi.fn().mockReturnValue(75),
}));

// Mock utils for saveDispatch
vi.mock('../../src/agents/utils.js', () => ({
  ensureOrganismDir: vi.fn().mockResolvedValue('/tmp/.organism/content/dispatches'),
  getOrganismPath: vi.fn((...parts: string[]) => parts.join('/')),
  writeJsonFile: vi.fn().mockResolvedValue(undefined),
}));

import { generateDispatch, saveDispatch } from '../../src/content/dispatch-generator.js';
import { generateNarrative, generateFallbackNarrative } from '../../src/content/narrative.js';
import { calculateFitnessScore } from '../../src/integrations/dashclaw/fitness.js';
import { writeJsonFile } from '../../src/agents/utils.js';

// ── helpers ─────────────────────────────────────────────────────────────

function makeCycleResult(overrides: Partial<CycleResult> = {}): CycleResult {
  return {
    cycle: 5,
    outcome: 'productive',
    changes_merged: 2,
    changes_attempted: 3,
    changes_approved: 2,
    changes_rejected: 1,
    duration_ms: 10000,
    api_tokens_used: 1200,
    regressions: [],
    ...overrides,
  };
}

function makeStateReport(): StateReport {
  return {
    timestamp: '2026-04-04T00:00:00Z',
    version: '1.0.0',
    git: {
      total_commits: 100, commits_last_7d: 10, commits_last_30d: 40,
      unique_authors_30d: 3, active_branches: 2, stale_branches: 0,
      last_commit_age_hours: 1, avg_commit_size_lines: 50,
    },
    quality: {
      test_file_count: 20, source_file_count: 40, test_ratio: 0.5,
      test_pass_rate: 1, test_coverage_percent: 85, lint_error_count: 0,
      files_exceeding_length_limit: [], functions_exceeding_complexity: [],
    },
    performance: {
      pulse_execution_ms: 500, hotspots_execution_ms: 500,
      ghosts_execution_ms: 500, benchmarked_against: 'v1.0.0',
    },
    dependencies: {
      total_count: 10, outdated_count: 0, vulnerable_count: 0,
      outdated_packages: [], vulnerabilities: [],
    },
    codebase: {
      total_files: 60, total_lines: 5000, avg_file_length: 83,
      largest_files: [], file_type_distribution: {},
    },
    anomalies: [],
    growth_signals: [],
  };
}

function makeEvent(overrides: Partial<OrganismEvent> = {}): OrganismEvent {
  return {
    id: 'evt-1',
    timestamp: '2026-04-04T00:00:00Z',
    cycle: 5,
    type: 'cycle-complete',
    agent: 'memory',
    summary: 'test event',
    data: {},
    tags: [],
    ...overrides,
  };
}

function makeKnowledgeBase(overrides: Partial<KnowledgeBase> = {}): KnowledgeBase {
  return {
    created: '2026-01-01T00:00:00Z',
    last_updated: '2026-04-04T00:00:00Z',
    cycle_count: 5,
    events: [],
    lessons: [],
    patterns: {
      fragile_files: [],
      rejection_reasons: {},
      successful_change_types: {},
      failed_change_types: {},
    },
    preferences: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateDispatch', () => {
  it('produces all required fields', async () => {
    const dispatch = await generateDispatch({
      cycleResult: makeCycleResult(),
      stateReport: makeStateReport(),
      plan: null,
      history: [],
      kb: null,
    });

    expect(dispatch.cycle).toBe(5);
    expect(dispatch.timestamp).toBeTruthy();
    expect(dispatch.headline).toBe('Test headline');
    expect(dispatch.narrative).toBe('Test narrative about the organism.');
    expect(dispatch.key_moments).toHaveLength(1);
    expect(dispatch.stats).toBeDefined();
    expect(dispatch.stats.changes_merged).toBe(2);
    expect(dispatch.stats.changes_rejected).toBe(1);
    expect(dispatch.content_hooks).toEqual(['hook1']);
    expect(dispatch.platform_versions).toBeDefined();
  });

  it('detects milestones from history', async () => {
    // First cycle ever -> first-cycle milestone
    const dispatch = await generateDispatch({
      cycleResult: makeCycleResult({ cycle: 1 }),
      stateReport: makeStateReport(),
      plan: null,
      history: [],
      kb: null,
    });

    expect(dispatch.milestone).toBe('first-cycle');
  });

  it('calculates streak from consecutive productive cycles', async () => {
    const history: CycleResult[] = [
      makeCycleResult({ cycle: 1, outcome: 'stable' }),
      makeCycleResult({ cycle: 2, outcome: 'productive' }),
      makeCycleResult({ cycle: 3, outcome: 'productive' }),
      makeCycleResult({ cycle: 4, outcome: 'productive' }),
    ];
    const dispatch = await generateDispatch({
      cycleResult: makeCycleResult({ cycle: 5, outcome: 'productive' }),
      stateReport: makeStateReport(),
      plan: null,
      history,
      kb: null,
    });

    // Streak: cycles 2,3,4 (from end) are productive = 3, plus current = 4
    expect(dispatch.stats.streak).toBe(4);
  });

  it('includes platform versions in all 4 formats', async () => {
    const dispatch = await generateDispatch({
      cycleResult: makeCycleResult(),
      stateReport: makeStateReport(),
      plan: null,
      history: [],
      kb: null,
    });

    expect(dispatch.platform_versions.twitter).toBeTruthy();
    expect(dispatch.platform_versions.linkedin).toBeTruthy();
    expect(dispatch.platform_versions.hn).toBeTruthy();
    expect(dispatch.platform_versions.blog).toBeTruthy();
  });

  it('falls back to template narrative when API fails', async () => {
    vi.mocked(generateNarrative).mockRejectedValueOnce(new Error('API unavailable'));

    const dispatch = await generateDispatch({
      cycleResult: makeCycleResult(),
      stateReport: makeStateReport(),
      plan: null,
      history: [],
      kb: null,
    });

    expect(generateFallbackNarrative).toHaveBeenCalled();
    expect(dispatch.headline).toBe('Fallback headline');
    expect(dispatch.narrative).toBe('Fallback narrative.');
  });

  it('extracts growth proposals from knowledge base events', async () => {
    const kb = makeKnowledgeBase({
      events: [
        makeEvent({ type: 'growth-proposed', cycle: 5, data: { title: 'Add caching' }, summary: 'Proposed caching' }),
        makeEvent({ type: 'growth-proposed', cycle: 5, data: { title: 'Add logging' }, summary: 'Proposed logging' }),
        makeEvent({ type: 'cycle-complete', cycle: 5 }),
      ],
    });

    const dispatch = await generateDispatch({
      cycleResult: makeCycleResult(),
      stateReport: makeStateReport(),
      plan: null,
      history: [makeCycleResult({ cycle: 4, changes_merged: 5 })],
      kb,
    });

    expect(dispatch.stats.growth_proposals).toBe(2);
  });
});

describe('saveDispatch', () => {
  it('writes file to .organism/content/dispatches/', async () => {
    const dispatch = {
      cycle: 5,
      timestamp: '2026-04-04T12:00:00.000Z',
      headline: 'Test',
      narrative: 'Test narrative',
      key_moments: [],
      stats: { changes_merged: 2, changes_rejected: 1, growth_proposals: 0, fitness_delta: 3, streak: 1 },
      content_hooks: [],
      platform_versions: { twitter: 't', linkedin: 'l', hn: 'h', blog: 'b' },
    };

    const filePath = await saveDispatch('/repo', dispatch);

    expect(filePath).toContain('content');
    expect(filePath).toContain('dispatches');
    expect(filePath).toContain('cycle-5');
    expect(writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('cycle-5'), dispatch);
  });
});
