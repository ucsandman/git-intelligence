import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getMemoryIndex } from '../../../src/agents/memory/index.js';
import { saveKnowledgeBase, initKnowledgeBase } from '../../../src/agents/memory/store.js';
import type { KnowledgeBase, Lesson, FragileFile } from '../../../src/agents/memory/types.js';

// ── helpers ─────────────────────────────────────────────────────────

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-memindex-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

function makeLessons(
  specs: Array<{ category: Lesson['category']; count: number; maxConfidence: number }>,
): Lesson[] {
  const lessons: Lesson[] = [];
  for (const { category, count, maxConfidence } of specs) {
    for (let i = 0; i < count; i++) {
      lessons.push({
        id: crypto.randomUUID(),
        learned_at: new Date(Date.now() - i * 86400000).toISOString(),
        lesson: `Lesson about ${category} number ${i}`,
        evidence_event_ids: [],
        confidence: i === 0 ? maxConfidence : maxConfidence - 0.1,
        category,
        times_referenced: 0,
      });
    }
  }
  return lessons;
}

// ── getMemoryIndex ────────────────────────────────────────────────

describe('getMemoryIndex', () => {
  it('returns index with correct counts for empty KB', async () => {
    const tmp = await makeTmpDir();
    const kb = initKnowledgeBase();
    await saveKnowledgeBase(tmp, kb);

    const index = await getMemoryIndex(tmp);

    expect(index.total_events).toBe(0);
    expect(index.categories).toEqual([]);
    expect(index.fragile_file_count).toBe(0);
    expect(index.preference_count).toBe(0);
    expect(index.top_fragile_files).toEqual([]);
    expect(index.cycle_count).toBe(0);
  });

  it('groups lessons by category with correct counts', async () => {
    const tmp = await makeTmpDir();
    const kb = initKnowledgeBase();
    kb.lessons = makeLessons([
      { category: 'regressions', count: 3, maxConfidence: 0.9 },
      { category: 'quality', count: 2, maxConfidence: 0.7 },
    ]);
    await saveKnowledgeBase(tmp, kb);

    const index = await getMemoryIndex(tmp);

    expect(index.categories).toHaveLength(2);

    const regressions = index.categories.find((c) => c.category === 'regressions');
    expect(regressions).toBeDefined();
    expect(regressions!.lesson_count).toBe(3);
    expect(regressions!.top_confidence).toBe(0.9);
    expect(regressions!.top_lesson).toBe('Lesson about regressions number 0');

    const quality = index.categories.find((c) => c.category === 'quality');
    expect(quality).toBeDefined();
    expect(quality!.lesson_count).toBe(2);
    expect(quality!.top_confidence).toBe(0.7);
    expect(quality!.top_lesson).toBe('Lesson about quality number 0');
  });

  it('returns top 5 fragile files sorted by regression count', async () => {
    const tmp = await makeTmpDir();
    const kb = initKnowledgeBase();
    const fragileFiles: FragileFile[] = [];
    for (let i = 0; i < 8; i++) {
      fragileFiles.push({
        path: `src/file-${i}.ts`,
        regression_count: i + 1,
        last_regression: new Date().toISOString(),
        notes: `File ${i}`,
      });
    }
    kb.patterns.fragile_files = fragileFiles;
    await saveKnowledgeBase(tmp, kb);

    const index = await getMemoryIndex(tmp);

    expect(index.fragile_file_count).toBe(8);
    expect(index.top_fragile_files).toHaveLength(5);
    // sorted descending by regression_count
    expect(index.top_fragile_files[0]!.regression_count).toBe(8);
    expect(index.top_fragile_files[1]!.regression_count).toBe(7);
    expect(index.top_fragile_files[2]!.regression_count).toBe(6);
    expect(index.top_fragile_files[3]!.regression_count).toBe(5);
    expect(index.top_fragile_files[4]!.regression_count).toBe(4);
    // only path and regression_count in output
    expect(index.top_fragile_files[0]).toEqual({ path: 'src/file-7.ts', regression_count: 8 });
  });

  it('includes preference count', async () => {
    const tmp = await makeTmpDir();
    const kb = initKnowledgeBase();
    kb.preferences = [
      {
        preference: 'Prefers small PRs',
        evidence_count: 3,
        first_observed: new Date().toISOString(),
        last_observed: new Date().toISOString(),
      },
      {
        preference: 'Uses conventional commits',
        evidence_count: 5,
        first_observed: new Date().toISOString(),
        last_observed: new Date().toISOString(),
      },
    ];
    await saveKnowledgeBase(tmp, kb);

    const index = await getMemoryIndex(tmp);

    expect(index.preference_count).toBe(2);
  });
});
