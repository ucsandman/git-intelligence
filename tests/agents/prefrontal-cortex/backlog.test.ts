import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  loadBacklog,
  saveWorkItem,
  updateWorkItemStatus,
  saveCyclePlan,
  loadLatestCyclePlan,
} from '../../../src/agents/prefrontal-cortex/backlog.js';
import type { WorkItem, CyclePlan } from '../../../src/agents/prefrontal-cortex/types.js';

// ── helpers ─────────────────────────────────────────────────────────

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-backlog-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: crypto.randomUUID(),
    tier: 3,
    priority_score: 50,
    title: 'Test item',
    description: 'Test description',
    rationale: 'Test rationale',
    target_files: ['src/test.ts'],
    estimated_complexity: 'small',
    memory_context: [],
    success_criteria: ['tests pass'],
    created_by: 'prefrontal-cortex',
    status: 'proposed',
    ...overrides,
  };
}

function makeCyclePlan(overrides: Partial<CyclePlan> = {}): CyclePlan {
  return {
    cycle_number: 1,
    timestamp: new Date().toISOString(),
    state_report_id: 'sr-001',
    selected_items: [],
    deferred_items: [],
    rationale: 'Test cycle plan',
    estimated_risk: 'low',
    memory_consulted: true,
    ...overrides,
  };
}

// ── loadBacklog ─────────────────────────────────────────────────────

describe('loadBacklog', () => {
  it('returns empty array for missing dir', async () => {
    const tmp = await makeTmpDir();
    const items = await loadBacklog(tmp);
    expect(items).toEqual([]);
  });

  it('skips non-JSON files', async () => {
    const tmp = await makeTmpDir();
    const backlogDir = path.join(tmp, '.organism', 'backlog');
    await fs.mkdir(backlogDir, { recursive: true });

    // Write a non-JSON file
    await fs.writeFile(path.join(backlogDir, 'readme.txt'), 'ignore me');

    // Write a valid work item
    const item = makeWorkItem();
    await fs.writeFile(path.join(backlogDir, `${item.id}.json`), JSON.stringify(item));

    const items = await loadBacklog(tmp);
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe(item.id);
  });

  it('skips cycle-plan files', async () => {
    const tmp = await makeTmpDir();
    const backlogDir = path.join(tmp, '.organism', 'backlog');
    await fs.mkdir(backlogDir, { recursive: true });

    // Write a cycle-plan file
    const plan = makeCyclePlan();
    await fs.writeFile(
      path.join(backlogDir, 'cycle-plan-2026-01-01T00-00-00.000Z.json'),
      JSON.stringify(plan),
    );

    // Write a valid work item
    const item = makeWorkItem();
    await fs.writeFile(path.join(backlogDir, `${item.id}.json`), JSON.stringify(item));

    const items = await loadBacklog(tmp);
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe(item.id);
  });
});

// ── saveWorkItem / loadBacklog round-trip ────────────────────────────

describe('saveWorkItem / loadBacklog round-trip', () => {
  it('round-trips a work item', async () => {
    const tmp = await makeTmpDir();
    const item = makeWorkItem();

    await saveWorkItem(tmp, item);
    const items = await loadBacklog(tmp);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(item);
  });

  it('saves multiple items', async () => {
    const tmp = await makeTmpDir();
    const item1 = makeWorkItem({ title: 'Item 1' });
    const item2 = makeWorkItem({ title: 'Item 2' });

    await saveWorkItem(tmp, item1);
    await saveWorkItem(tmp, item2);
    const items = await loadBacklog(tmp);

    expect(items).toHaveLength(2);
    const titles = items.map((i) => i.title).sort();
    expect(titles).toEqual(['Item 1', 'Item 2']);
  });
});

// ── updateWorkItemStatus ────────────────────────────────────────────

describe('updateWorkItemStatus', () => {
  it('updates status on disk', async () => {
    const tmp = await makeTmpDir();
    const item = makeWorkItem({ status: 'proposed' });

    await saveWorkItem(tmp, item);
    await updateWorkItemStatus(tmp, item.id, 'in-progress');

    const items = await loadBacklog(tmp);
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe('in-progress');
  });

  it('throws for missing item', async () => {
    const tmp = await makeTmpDir();
    await expect(updateWorkItemStatus(tmp, 'nonexistent-id', 'completed')).rejects.toThrow(
      'Work item not found: nonexistent-id',
    );
  });
});

// ── saveCyclePlan ───────────────────────────────────────────────────

describe('saveCyclePlan', () => {
  it('writes with Windows-safe filename', async () => {
    const tmp = await makeTmpDir();
    const plan = makeCyclePlan({ timestamp: '2026-01-15T10:30:00.000Z' });

    const planPath = await saveCyclePlan(tmp, plan);

    // Colons replaced with hyphens for Windows compatibility
    const filename = path.basename(planPath);
    expect(filename).toBe('cycle-plan-2026-01-15T10-30-00.000Z.json');
    expect(filename).not.toContain(':');

    // File should actually exist
    const stat = await fs.stat(planPath);
    expect(stat.isFile()).toBe(true);
  });

  it('round-trips cycle plan data', async () => {
    const tmp = await makeTmpDir();
    const item = makeWorkItem();
    const plan = makeCyclePlan({
      selected_items: [item],
      rationale: 'Focused on high-priority fix',
    });

    await saveCyclePlan(tmp, plan);
    const loaded = await loadLatestCyclePlan(tmp);

    expect(loaded).toEqual(plan);
  });
});

// ── loadLatestCyclePlan ─────────────────────────────────────────────

describe('loadLatestCyclePlan', () => {
  it('returns null for empty dir', async () => {
    const tmp = await makeTmpDir();
    const plan = await loadLatestCyclePlan(tmp);
    expect(plan).toBeNull();
  });

  it('returns null when backlog dir exists but has no cycle plans', async () => {
    const tmp = await makeTmpDir();
    const backlogDir = path.join(tmp, '.organism', 'backlog');
    await fs.mkdir(backlogDir, { recursive: true });

    // Only a work item, no cycle plans
    const item = makeWorkItem();
    await fs.writeFile(path.join(backlogDir, `${item.id}.json`), JSON.stringify(item));

    const plan = await loadLatestCyclePlan(tmp);
    expect(plan).toBeNull();
  });

  it('returns most recent plan when multiple exist', async () => {
    const tmp = await makeTmpDir();

    const olderPlan = makeCyclePlan({
      cycle_number: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      rationale: 'Older plan',
    });
    const newerPlan = makeCyclePlan({
      cycle_number: 2,
      timestamp: '2026-01-02T00:00:00.000Z',
      rationale: 'Newer plan',
    });

    await saveCyclePlan(tmp, olderPlan);
    await saveCyclePlan(tmp, newerPlan);

    const latest = await loadLatestCyclePlan(tmp);
    expect(latest).toEqual(newerPlan);
    expect(latest!.rationale).toBe('Newer plan');
  });
});
