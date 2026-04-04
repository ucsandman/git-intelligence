import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  initKnowledgeBase,
  loadKnowledgeBase,
  saveKnowledgeBase,
  createEvent,
  recordEvent,
} from '../../../src/agents/memory/store.js';
import type { KnowledgeBase } from '../../../src/agents/memory/types.js';

// ── helpers ─────────────────────────────────────────────────────────

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-memory-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

// ── initKnowledgeBase ──────────────────────────────────────────────

describe('initKnowledgeBase', () => {
  it('creates a valid empty KB with correct structure', () => {
    const kb = initKnowledgeBase();

    expect(kb.created).toBeDefined();
    expect(() => new Date(kb.created)).not.toThrow();
    expect(new Date(kb.created).toISOString()).toBe(kb.created);

    expect(kb.last_updated).toBeDefined();
    expect(kb.cycle_count).toBe(0);
    expect(kb.events).toEqual([]);
    expect(kb.lessons).toEqual([]);
    expect(kb.preferences).toEqual([]);

    expect(kb.patterns).toEqual({
      fragile_files: [],
      rejection_reasons: {},
      successful_change_types: {},
      failed_change_types: {},
    });
  });
});

// ── loadKnowledgeBase ──────────────────────────────────────────────

describe('loadKnowledgeBase', () => {
  it('returns fresh KB for missing file', async () => {
    const tmp = await makeTmpDir();
    const kb = await loadKnowledgeBase(tmp);

    expect(kb.cycle_count).toBe(0);
    expect(kb.events).toEqual([]);
    expect(kb.lessons).toEqual([]);
    expect(kb.preferences).toEqual([]);
  });
});

// ── saveKnowledgeBase / loadKnowledgeBase round-trip ───────────────

describe('saveKnowledgeBase / loadKnowledgeBase round-trip', () => {
  it('round-trips correctly', async () => {
    const tmp = await makeTmpDir();
    const kb = initKnowledgeBase();
    const event = createEvent('change-merged', 'memory', 'test event', { key: 'val' }, ['tag1'], 1);
    const updated = recordEvent(kb, event);

    await saveKnowledgeBase(tmp, updated);
    const loaded = await loadKnowledgeBase(tmp);

    expect(loaded).toEqual(updated);
  });
});

// ── createEvent ────────────────────────────────────────────────────

describe('createEvent', () => {
  it('returns an event with a valid UUID, timestamp, and all fields populated', () => {
    const event = createEvent('regression-detected', 'immune-system', 'Found regression', { file: 'a.ts' }, ['quality'], 5);

    // valid UUID v4 format
    expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // valid ISO timestamp
    expect(() => new Date(event.timestamp)).not.toThrow();
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);

    expect(event.type).toBe('regression-detected');
    expect(event.agent).toBe('immune-system');
    expect(event.summary).toBe('Found regression');
    expect(event.data).toEqual({ file: 'a.ts' });
    expect(event.tags).toEqual(['quality']);
    expect(event.cycle).toBe(5);
  });

  it('uses default values for optional params', () => {
    const event = createEvent('baseline-updated', 'sensory-cortex', 'Updated baselines');

    expect(event.data).toEqual({});
    expect(event.tags).toEqual([]);
    expect(event.cycle).toBe(0);
  });
});

// ── recordEvent ────────────────────────────────────────────────────

describe('recordEvent', () => {
  it('adds event to KB and updates last_updated timestamp', async () => {
    const kb = initKnowledgeBase();
    const originalUpdated = kb.last_updated;

    // small delay to ensure timestamp differs
    await new Promise((resolve) => setTimeout(resolve, 10));

    const event = createEvent('change-merged', 'motor-cortex', 'Merged PR #42');
    const updated = recordEvent(kb, event);

    expect(updated.events).toHaveLength(1);
    expect(updated.events[0]).toEqual(event);
    expect(new Date(updated.last_updated).getTime()).toBeGreaterThanOrEqual(new Date(originalUpdated).getTime());
  });

  it('does not mutate the original KB (returns new object)', () => {
    const kb = initKnowledgeBase();
    const event = createEvent('anomaly-detected', 'sensory-cortex', 'Spike in errors');
    const updated = recordEvent(kb, event);

    expect(kb.events).toHaveLength(0);
    expect(updated.events).toHaveLength(1);
    expect(kb).not.toBe(updated);
    expect(kb.events).not.toBe(updated.events);
  });
});
