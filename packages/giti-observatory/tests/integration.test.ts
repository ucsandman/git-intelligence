import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildSnapshot } from '../src/data/snapshot-builder';
import { mapSnapshotToScene } from '../src/lib/scene-mapper';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname, '.test-integration');
const ORGANISM_DIR = join(TEST_DIR, '.organism');

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

beforeEach(async () => {
  await mkdir(join(ORGANISM_DIR, 'state-reports'), { recursive: true });
  await mkdir(join(ORGANISM_DIR, 'content', 'dispatches'), { recursive: true });

  await writeJson(join(TEST_DIR, 'organism.json'), {
    identity: { name: 'integration-test', purpose: 'testing observatory' },
    boundaries: { growth_zone: ['src/'], forbidden_zone: [] },
    quality_standards: {
      test_coverage_floor: 80,
      max_complexity_per_function: 15,
      max_file_length: 300,
      zero_tolerance: [],
      performance_budget: {},
    },
    lifecycle: {
      cycle_frequency: '6h',
      max_changes_per_cycle: 3,
      mandatory_cooldown_after_regression: '48h',
      branch_naming: 'organism/cycle-{n}-{title}',
      requires_immune_approval: true,
    },
    evolutionary_principles: ['test everything'],
  });

  await writeJson(join(ORGANISM_DIR, 'cycle-counter.json'), { count: 25 });
  await writeJson(join(ORGANISM_DIR, 'knowledge-base.json'), {
    created: '2026-01-01T00:00:00Z',
    last_updated: '2026-04-08T00:00:00Z',
    cycle_count: 25,
    events: [
      { id: 'e1', timestamp: '2026-03-01T00:00:00Z', cycle: 1, type: 'change-merged', agent: 'motor-cortex', summary: 'Initial fix', data: {}, tags: [] },
      { id: 'e2', timestamp: '2026-03-05T00:00:00Z', cycle: 5, type: 'regression-detected', agent: 'immune-system', summary: 'Test regression', data: {}, tags: [] },
      { id: 'e3', timestamp: '2026-03-06T00:00:00Z', cycle: 6, type: 'change-merged', agent: 'motor-cortex', summary: 'Recovery fix', data: {}, tags: [] },
      { id: 'e4', timestamp: '2026-04-01T00:00:00Z', cycle: 20, type: 'growth-proposed', agent: 'growth-hormone', summary: 'New feature idea', data: {}, tags: [] },
      { id: 'e5', timestamp: '2026-04-02T00:00:00Z', cycle: 20, type: 'growth-approved', agent: 'prefrontal-cortex', summary: 'Feature approved', data: {}, tags: [] },
    ],
    lessons: [
      { text: 'Always check test coverage', confidence: 0.9 },
      { text: 'Small changes are safer', confidence: 0.8 },
    ],
    patterns: {
      fragile_files: [{ file: 'src/core.ts', regression_count: 3 }],
      rejection_reasons: { 'test-drop': 5, 'complexity': 2 },
      successful_change_types: { bugfix: 10, feature: 5 },
      failed_change_types: { feature: 3, refactor: 1 },
    },
    preferences: [{ key: 'small-diffs', value: 'Prefer small focused changes' }],
  });

  await writeJson(
    join(ORGANISM_DIR, 'content', 'dispatches', 'cycle-20-2026-04-01.json'),
    {
      cycle: 20,
      timestamp: '2026-04-01T00:00:00Z',
      headline: 'The organism proposed its first self-improvement',
      narrative: 'In a significant moment, the organism analyzed its own telemetry and proposed a new feature.',
      key_moments: [{ moment: 'Growth proposal', significance: 'First autonomous feature idea' }],
      stats: { changes_merged: 1, changes_rejected: 0, growth_proposals: 1, fitness_delta: 2, streak: 3 },
      milestone: 'first-growth-proposal',
    },
  );
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('full snapshot → scene round-trip', () => {
  it('builds snapshot and maps to valid scene state', async () => {
    const snapshot = await buildSnapshot(TEST_DIR);

    // Snapshot validity
    expect(snapshot.organism.name).toBe('integration-test');
    expect(snapshot.organism.total_cycles).toBe(25);
    expect(snapshot.milestones).toContain('first-growth-proposal');
    expect(snapshot.knowledge.fragile_files).toContain('src/core.ts');
    expect(snapshot.knowledge.total_lessons).toBe(2);

    // Scene mapping
    const scene = mapSnapshotToScene(snapshot);

    expect(scene.creature.mood).toBe('content'); // idle state
    expect(scene.creature.maturity).toBe(0.5); // 25/50
    expect(scene.creature.bioluminescence).toBeGreaterThan(0);
    expect(scene.creature.personality.caution).toBeGreaterThan(0);

    expect(scene.environment.flora.length).toBeGreaterThan(0);
    expect(scene.environment.fossils.length).toBe(1);
    expect(scene.environment.fossils[0]!.milestone).toBe('first-growth-proposal');

    // Spores: one growth-proposed event → one spore (approved)
    const approvedSpores = scene.environment.spores.filter(
      (s) => s.status === 'rooted',
    );
    expect(approvedSpores.length).toBeGreaterThanOrEqual(1);

    expect(scene.activity.isLive).toBe(false);
  });
});
