import { describe, it, expect } from 'vitest';
import { formatCyclePlan } from '../../../src/agents/prefrontal-cortex/formatter.js';
import type { CyclePlan, WorkItem } from '../../../src/agents/prefrontal-cortex/types.js';

function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'wi-001',
    title: 'Fix failing tests',
    description: 'Fix all failing tests',
    tier: 1 as const,
    priority_score: 100,
    rationale: 'Tests are broken',
    target_files: ['src/foo.ts'],
    estimated_complexity: 'medium',
    success_criteria: ['All tests pass'],
    memory_context: [],
    status: 'proposed' as const,
    ...overrides,
  };
}

function makePlan(overrides: Partial<CyclePlan> = {}): CyclePlan {
  return {
    cycle_number: 1,
    timestamp: '2026-04-01T00:00:00.000Z',
    state_report_id: 'sr-001',
    selected_items: [makeWorkItem()],
    deferred_items: [],
    rationale: 'Standard prioritization',
    estimated_risk: 'low',
    memory_consulted: false,
    ...overrides,
  };
}

describe('formatCyclePlan', () => {
  it('formats a plan with selected items', () => {
    const result = formatCyclePlan(makePlan());
    expect(result).toContain('Cycle Plan #1');
    expect(result).toContain('Fix failing tests');
    expect(result).toContain('Tier 1');
    expect(result).toContain('Tests are broken');
    expect(result).toContain('src/foo.ts');
    expect(result).toContain('medium');
    expect(result).toContain('low');
  });

  it('shows stable message when no work items', () => {
    const result = formatCyclePlan(makePlan({ selected_items: [] }));
    expect(result).toContain('No work items');
    expect(result).toContain('stable');
  });

  it('shows deferred items', () => {
    const result = formatCyclePlan(makePlan({
      deferred_items: [makeWorkItem({ title: 'Deferred task', tier: 3 })],
    }));
    expect(result).toContain('Deferred');
    expect(result).toContain('Deferred task');
    expect(result).toContain('Tier 3');
  });

  it('does not show deferred section when empty', () => {
    const result = formatCyclePlan(makePlan({ deferred_items: [] }));
    expect(result).not.toContain('Deferred:');
  });

  it('formats tier colors for different tiers', () => {
    const items = [
      makeWorkItem({ title: 'T1', tier: 1 }),
      makeWorkItem({ title: 'T2', tier: 2 }),
      makeWorkItem({ title: 'T3', tier: 3 }),
    ];
    const result = formatCyclePlan(makePlan({ selected_items: items }));
    expect(result).toContain('Tier 1');
    expect(result).toContain('Tier 2');
    expect(result).toContain('Tier 3');
  });

  it('shows in cooldown status for high risk', () => {
    const result = formatCyclePlan(makePlan({ estimated_risk: 'high' }));
    expect(result).toContain('in cooldown');
  });

  it('shows healthy status for non-high risk', () => {
    const result = formatCyclePlan(makePlan({ estimated_risk: 'low' }));
    expect(result).toContain('healthy');
  });

  it('shows (none) for items with no target files', () => {
    const result = formatCyclePlan(makePlan({
      selected_items: [makeWorkItem({ target_files: [] })],
    }));
    expect(result).toContain('(none)');
  });

  it('formats multiple selected items with separators', () => {
    const result = formatCyclePlan(makePlan({
      selected_items: [
        makeWorkItem({ title: 'Item A' }),
        makeWorkItem({ title: 'Item B' }),
      ],
    }));
    expect(result).toContain('Planned work (2 items)');
    expect(result).toContain('Item A');
    expect(result).toContain('Item B');
  });
});
