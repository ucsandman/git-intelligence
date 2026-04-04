import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkItem, CyclePlan } from './types.js';
import { readJsonFile, writeJsonFile, ensureOrganismDir, getOrganismPath } from '../utils.js';

const BACKLOG_DIR = 'backlog';

export async function loadBacklog(repoPath: string): Promise<WorkItem[]> {
  const dir = getOrganismPath(repoPath, BACKLOG_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const items: WorkItem[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json') || entry.startsWith('cycle-plan')) continue;
    const item = await readJsonFile<WorkItem>(path.join(dir, entry));
    if (item?.id) items.push(item);
  }
  return items;
}

export async function saveWorkItem(repoPath: string, item: WorkItem): Promise<void> {
  await ensureOrganismDir(repoPath, BACKLOG_DIR);
  await writeJsonFile(getOrganismPath(repoPath, BACKLOG_DIR, `${item.id}.json`), item);
}

export async function updateWorkItemStatus(
  repoPath: string,
  id: string,
  status: WorkItem['status'],
): Promise<void> {
  const filePath = getOrganismPath(repoPath, BACKLOG_DIR, `${id}.json`);
  const item = await readJsonFile<WorkItem>(filePath);
  if (!item) throw new Error(`Work item not found: ${id}`);
  item.status = status;
  await writeJsonFile(filePath, item);
}

export async function saveCyclePlan(repoPath: string, plan: CyclePlan): Promise<string> {
  await ensureOrganismDir(repoPath, BACKLOG_DIR);
  const safeTs = plan.timestamp.replace(/:/g, '-');
  const filename = `cycle-plan-${safeTs}.json`;
  const planPath = getOrganismPath(repoPath, BACKLOG_DIR, filename);
  await writeJsonFile(planPath, plan);
  return planPath;
}

export async function loadLatestCyclePlan(repoPath: string): Promise<CyclePlan | null> {
  const dir = getOrganismPath(repoPath, BACKLOG_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  const plans = entries
    .filter((e) => e.startsWith('cycle-plan') && e.endsWith('.json'))
    .sort();
  if (plans.length === 0) return null;
  return readJsonFile<CyclePlan>(path.join(dir, plans[plans.length - 1]!));
}
