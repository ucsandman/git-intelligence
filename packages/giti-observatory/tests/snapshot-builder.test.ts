import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildSnapshot } from '../src/data/snapshot-builder.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname, '.test-repo');
const ORGANISM_DIR = join(TEST_DIR, '.organism');

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

beforeEach(async () => {
  await mkdir(join(ORGANISM_DIR, 'state-reports'), { recursive: true });
  await mkdir(join(ORGANISM_DIR, 'content', 'dispatches'), { recursive: true });
  await mkdir(join(ORGANISM_DIR, 'backlog'), { recursive: true });
  await mkdir(join(ORGANISM_DIR, 'reviews'), { recursive: true });

  // organism.json at repo root
  await writeJson(join(TEST_DIR, 'organism.json'), {
    identity: { name: 'test-organism', purpose: 'testing' },
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
    evolutionary_principles: [],
  });

  await writeJson(join(ORGANISM_DIR, 'cycle-counter.json'), { count: 5 });
  await writeJson(join(ORGANISM_DIR, 'knowledge-base.json'), {
    created: '2026-01-01T00:00:00Z',
    last_updated: '2026-04-08T00:00:00Z',
    cycle_count: 5,
    events: [
      {
        id: 'evt-1',
        timestamp: '2026-04-08T10:00:00Z',
        cycle: 5,
        type: 'change-merged',
        agent: 'motor-cortex',
        summary: 'Merged fix for parser bug',
        data: {},
        tags: ['bugfix'],
      },
    ],
    lessons: [{ text: 'Always run tests', confidence: 0.9 }],
    patterns: {
      fragile_files: [{ file: 'src/parser.ts', regression_count: 2 }],
      rejection_reasons: { 'test-coverage-drop': 3 },
      successful_change_types: { bugfix: 4 },
      failed_change_types: { feature: 1 },
    },
    preferences: [{ key: 'small-changes', value: 'prefer small diffs' }],
  });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('buildSnapshot', () => {
  it('builds a valid snapshot from .organism/ directory', async () => {
    const snapshot = await buildSnapshot(TEST_DIR);

    expect(snapshot.organism.name).toBe('test-organism');
    expect(snapshot.organism.total_cycles).toBe(5);
    expect(snapshot.organism.current_state).toBe('idle');
    expect(snapshot.vitals).toBeDefined();
    expect(snapshot.knowledge.total_lessons).toBe(1);
    expect(snapshot.knowledge.fragile_files).toContain('src/parser.ts');
    expect(snapshot.recent_events).toHaveLength(1);
    expect(snapshot.recent_events[0]!.type).toBe('change-merged');
  });

  it('detects active state when active-cycle.json exists', async () => {
    await writeJson(join(ORGANISM_DIR, 'active-cycle.json'), {
      cycle: 6,
      phase: 'build',
      started: '2026-04-08T12:00:00Z',
    });

    const snapshot = await buildSnapshot(TEST_DIR);
    expect(snapshot.organism.current_state).toBe('active');
    expect(snapshot.current_cycle).toBeDefined();
    expect(snapshot.current_cycle!.phase).toBe('build');
  });

  it('detects cooldown state', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    await writeJson(join(ORGANISM_DIR, 'cooldown-until.json'), {
      until: future,
    });

    const snapshot = await buildSnapshot(TEST_DIR);
    expect(snapshot.organism.current_state).toBe('cooldown');
  });

  it('detects killed state when kill-switch exists', async () => {
    await writeFile(join(ORGANISM_DIR, 'kill-switch'), '', 'utf-8');

    const snapshot = await buildSnapshot(TEST_DIR);
    expect(snapshot.organism.current_state).toBe('killed');
  });
});
