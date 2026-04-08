import { describe, it, expect } from 'vitest';
import { mapSnapshotToScene } from '../src/lib/scene-mapper.js';
import type { ObservatorySnapshot } from '../src/types/snapshot.js';

function makeSnapshot(
  overrides: Partial<ObservatorySnapshot> = {},
): ObservatorySnapshot {
  return {
    organism: {
      name: 'test',
      version: '0.1.0',
      born: '2026-01-01T00:00:00Z',
      total_cycles: 10,
      total_changes_merged: 8,
      current_state: 'idle',
      ...overrides.organism,
    },
    vitals: {
      fitness_score: 75,
      test_coverage: 85,
      complexity_avg: 8,
      dependency_health: 90,
      commit_velocity_7d: 5,
      mutation_success_rate: 80,
      regression_rate: 10,
      ...overrides.vitals,
    },
    current_cycle: overrides.current_cycle ?? undefined,
    history: overrides.history ?? [
      {
        cycle: 1,
        timestamp: '2026-01-01T00:00:00Z',
        outcome: 'productive',
        changes_merged: 1,
        changes_rejected: 0,
        growth_proposals: 0,
        api_tokens_used: 100,
        duration_ms: 5000,
      },
    ],
    dispatches: overrides.dispatches ?? [],
    milestones: overrides.milestones ?? [],
    recent_events: overrides.recent_events ?? [],
    knowledge: {
      total_lessons: 3,
      fragile_files: [],
      rejection_reasons: {},
      successful_change_types: { bugfix: 4 },
      failed_change_types: { feature: 1 },
      preferences: [],
      ...overrides.knowledge,
    },
  };
}

describe('mapSnapshotToScene', () => {
  it('maps idle state to content mood', () => {
    const scene = mapSnapshotToScene(makeSnapshot());
    expect(scene.creature.mood).toBe('content');
    expect(scene.activity.isLive).toBe(false);
  });

  it('maps active state to alert mood', () => {
    const scene = mapSnapshotToScene(
      makeSnapshot({
        organism: {
          name: 'test',
          version: '0.1.0',
          born: '2026-01-01T00:00:00Z',
          total_cycles: 10,
          total_changes_merged: 8,
          current_state: 'active',
        },
        current_cycle: {
          number: 11,
          phase: 'build',
          started: '2026-04-08T12:00:00Z',
          events: [],
        },
      }),
    );
    expect(scene.creature.mood).toBe('alert');
    expect(scene.activity.isLive).toBe(true);
    expect(scene.activity.currentPhase).toBe('build');
  });

  it('maps cooldown to resting mood', () => {
    const scene = mapSnapshotToScene(
      makeSnapshot({
        organism: {
          name: 'test',
          version: '0.1.0',
          born: '2026-01-01T00:00:00Z',
          total_cycles: 10,
          total_changes_merged: 8,
          current_state: 'cooldown',
        },
      }),
    );
    expect(scene.creature.mood).toBe('resting');
  });

  it('maps killed to dormant mood', () => {
    const scene = mapSnapshotToScene(
      makeSnapshot({
        organism: {
          name: 'test',
          version: '0.1.0',
          born: '2026-01-01T00:00:00Z',
          total_cycles: 10,
          total_changes_merged: 8,
          current_state: 'killed',
        },
      }),
    );
    expect(scene.creature.mood).toBe('dormant');
  });

  it('maps fitness to bioluminescence', () => {
    const highFitness = mapSnapshotToScene(
      makeSnapshot({ vitals: { fitness_score: 95, test_coverage: 95, complexity_avg: 5, dependency_health: 95, commit_velocity_7d: 10, mutation_success_rate: 90, regression_rate: 2 } }),
    );
    const lowFitness = mapSnapshotToScene(
      makeSnapshot({ vitals: { fitness_score: 30, test_coverage: 30, complexity_avg: 20, dependency_health: 40, commit_velocity_7d: 1, mutation_success_rate: 20, regression_rate: 40 } }),
    );
    expect(highFitness.creature.bioluminescence).toBeGreaterThan(
      lowFitness.creature.bioluminescence,
    );
  });

  it('maps test coverage to ground lushness', () => {
    const scene = mapSnapshotToScene(
      makeSnapshot({ vitals: { fitness_score: 75, test_coverage: 90, complexity_avg: 8, dependency_health: 90, commit_velocity_7d: 5, mutation_success_rate: 80, regression_rate: 10 } }),
    );
    expect(scene.environment.groundLushness).toBeGreaterThan(0.8);
  });

  it('creates flora from productive history cycles', () => {
    const scene = mapSnapshotToScene(
      makeSnapshot({
        history: [
          { cycle: 1, timestamp: '2026-01-01T00:00:00Z', outcome: 'productive', changes_merged: 2, changes_rejected: 0, growth_proposals: 0, api_tokens_used: 100, duration_ms: 5000 },
          { cycle: 2, timestamp: '2026-01-02T00:00:00Z', outcome: 'productive', changes_merged: 1, changes_rejected: 0, growth_proposals: 0, api_tokens_used: 100, duration_ms: 5000 },
          { cycle: 3, timestamp: '2026-01-03T00:00:00Z', outcome: 'stable', changes_merged: 0, changes_rejected: 0, growth_proposals: 0, api_tokens_used: 50, duration_ms: 3000 },
        ],
      }),
    );
    expect(scene.environment.flora.length).toBe(3); // 2 + 1 merged changes
  });

  it('derives personality from knowledge patterns', () => {
    const scene = mapSnapshotToScene(
      makeSnapshot({
        knowledge: {
          total_lessons: 5,
          fragile_files: [],
          rejection_reasons: { 'test-drop': 10, 'complexity': 5 },
          successful_change_types: { bugfix: 2 },
          failed_change_types: { feature: 8 },
          preferences: [],
        },
      }),
    );
    // High rejection → high caution
    expect(scene.creature.personality.caution).toBeGreaterThan(0.5);
  });
});
