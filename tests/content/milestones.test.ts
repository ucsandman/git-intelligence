import { describe, it, expect } from 'vitest';
import type { CycleResult } from '../../src/agents/orchestrator/types.js';
import type { KnowledgeBase } from '../../src/agents/memory/types.js';
import type { OrganismEvent } from '../../src/agents/types.js';
import { detectMilestone } from '../../src/content/milestones.js';

function makeCycleResult(overrides: Partial<CycleResult> = {}): CycleResult {
  return {
    cycle: 1,
    outcome: 'productive',
    changes_merged: 1,
    changes_attempted: 1,
    changes_approved: 1,
    changes_rejected: 0,
    duration_ms: 5000,
    api_tokens_used: 500,
    regressions: [],
    ...overrides,
  };
}

function makeKnowledgeBase(events: OrganismEvent[] = []): KnowledgeBase {
  return {
    created: '2025-01-01T00:00:00Z',
    last_updated: '2025-01-01T00:00:00Z',
    cycle_count: 1,
    events,
    lessons: [],
    patterns: {
      fragile_files: [],
      rejection_reasons: {},
      successful_change_types: {},
      failed_change_types: {},
    },
    preferences: [],
  };
}

function makeEvent(overrides: Partial<OrganismEvent> = {}): OrganismEvent {
  return {
    id: 'evt-1',
    timestamp: '2025-01-01T00:00:00Z',
    cycle: 1,
    type: 'cycle-complete',
    agent: 'memory',
    summary: 'test event',
    data: {},
    tags: [],
    ...overrides,
  };
}

describe('detectMilestone', () => {
  it('returns first-cycle when history is empty', () => {
    const result = makeCycleResult({ cycle: 1 });
    expect(detectMilestone(result, [], null)).toBe('first-cycle');
  });

  it('returns first-merge when first merge happens', () => {
    const history = [makeCycleResult({ cycle: 1, changes_merged: 0 })];
    const result = makeCycleResult({ cycle: 2, changes_merged: 1 });
    expect(detectMilestone(result, history, null)).toBe('first-merge');
  });

  it('returns changes-10 on 10th merge', () => {
    const history = [makeCycleResult({ cycle: 1, changes_merged: 9 })];
    const result = makeCycleResult({ cycle: 2, changes_merged: 1 });
    expect(detectMilestone(result, history, null)).toBe('changes-10');
  });

  it('returns changes-25 on 25th merge', () => {
    const history = [makeCycleResult({ cycle: 1, changes_merged: 24 })];
    const result = makeCycleResult({ cycle: 2, changes_merged: 1 });
    expect(detectMilestone(result, history, null)).toBe('changes-25');
  });

  it('returns changes-50 on 50th merge', () => {
    const history = [makeCycleResult({ cycle: 1, changes_merged: 49 })];
    const result = makeCycleResult({ cycle: 2, changes_merged: 1 });
    expect(detectMilestone(result, history, null)).toBe('changes-50');
  });

  it('returns changes-100 on 100th merge', () => {
    const history = [makeCycleResult({ cycle: 1, changes_merged: 99 })];
    const result = makeCycleResult({ cycle: 2, changes_merged: 1 });
    expect(detectMilestone(result, history, null)).toBe('changes-100');
  });

  it('returns first-growth-proposal when KB has one growth-proposed event for this cycle', () => {
    const result = makeCycleResult({ cycle: 5 });
    const kb = makeKnowledgeBase([
      makeEvent({ type: 'growth-proposed', cycle: 5 }),
    ]);
    const history = [makeCycleResult({ cycle: 4, changes_merged: 5 })];
    expect(detectMilestone(result, history, kb)).toBe('first-growth-proposal');
  });

  it('returns first-growth-shipped when KB has one growth-approved event for this cycle', () => {
    const result = makeCycleResult({ cycle: 5 });
    const kb = makeKnowledgeBase([
      makeEvent({ type: 'growth-proposed', cycle: 3 }),
      makeEvent({ type: 'growth-proposed', cycle: 4 }),
      makeEvent({ type: 'growth-approved', cycle: 5 }),
    ]);
    const history = [makeCycleResult({ cycle: 4, changes_merged: 5 })];
    expect(detectMilestone(result, history, kb)).toBe('first-growth-shipped');
  });

  it('returns first-self-rejection when KB has one growth-rejected event for this cycle', () => {
    const result = makeCycleResult({ cycle: 5 });
    const kb = makeKnowledgeBase([
      makeEvent({ type: 'growth-proposed', cycle: 3 }),
      makeEvent({ type: 'growth-rejected', cycle: 5 }),
    ]);
    const history = [makeCycleResult({ cycle: 4, changes_merged: 5 })];
    expect(detectMilestone(result, history, kb)).toBe('first-self-rejection');
  });

  it('returns first-self-fix when previous cycle had regression and this one fixes it', () => {
    const history = [
      makeCycleResult({ cycle: 1, changes_merged: 5, regressions: [] }),
      makeCycleResult({ cycle: 2, changes_merged: 1, regressions: ['test failed'] }),
    ];
    const result = makeCycleResult({ cycle: 3, changes_merged: 1, regressions: [] });
    expect(detectMilestone(result, history, null)).toBe('first-self-fix');
  });

  it('returns undefined when nothing special happens', () => {
    const history = [
      makeCycleResult({ cycle: 1, changes_merged: 3 }),
      makeCycleResult({ cycle: 2, changes_merged: 2 }),
    ];
    const result = makeCycleResult({ cycle: 3, changes_merged: 1 });
    expect(detectMilestone(result, history, null)).toBeUndefined();
  });

  it('does not trigger merge milestone on non-exact threshold (9 merged)', () => {
    const history = [makeCycleResult({ cycle: 1, changes_merged: 8 })];
    const result = makeCycleResult({ cycle: 2, changes_merged: 1 });
    // totalMerged = 9, which doesn't cross any threshold
    expect(detectMilestone(result, history, null)).toBeUndefined();
  });

  it('does not return first-self-fix if it has happened before', () => {
    const history = [
      makeCycleResult({ cycle: 1, changes_merged: 3, regressions: ['bug'] }),
      makeCycleResult({ cycle: 2, changes_merged: 1, regressions: [] }), // first self-fix already occurred
      makeCycleResult({ cycle: 3, changes_merged: 1, regressions: ['another bug'] }),
    ];
    const result = makeCycleResult({ cycle: 4, changes_merged: 1, regressions: [] });
    // This would be a second self-fix, so milestone should not trigger
    expect(detectMilestone(result, history, null)).toBeUndefined();
  });
});
