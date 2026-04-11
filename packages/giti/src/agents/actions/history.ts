import path from 'node:path';
import { ensureOrganismDir, getOrganismPath, readJsonFile, writeJsonFile } from '../utils.js';
import { assertActionInstance } from './schema.js';
import type { ActionInstance } from './types.js';

interface ActionInstanceIndexEntry {
  id: string;
  template_id: string;
  status: ActionInstance['status'];
  updated_at: string;
}

interface ActionInstancePatch {
  status?: ActionInstance['status'];
  started_at?: string;
  completed_at?: string;
  failure_reason?: string;
  step_results?: ActionInstance['step_results'];
}

function getActionsRoot(repoPath: string): string {
  return getOrganismPath(repoPath, 'actions');
}

function getInstancesRoot(repoPath: string): string {
  return path.join(getActionsRoot(repoPath), 'instances');
}

function getActionInstancePath(repoPath: string, id: string): string {
  return path.join(getInstancesRoot(repoPath), `${id}.json`);
}

function getActionIndexPath(repoPath: string): string {
  return path.join(getActionsRoot(repoPath), 'index.json');
}

function getInstanceTimestamp(instance: ActionInstance): string {
  return (
    instance.completed_at ??
    instance.started_at ??
    new Date(0).toISOString()
  );
}

async function saveActionIndex(repoPath: string, instances: ActionInstance[]): Promise<void> {
  const entries: ActionInstanceIndexEntry[] = instances
    .map((instance) => ({
      id: instance.id,
      template_id: instance.template_id,
      status: instance.status,
      updated_at: getInstanceTimestamp(instance),
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  await writeJsonFile(getActionIndexPath(repoPath), entries);
}

export async function saveActionInstance(
  repoPath: string,
  instance: ActionInstance,
): Promise<ActionInstance> {
  const parsed = assertActionInstance(instance);
  await ensureOrganismDir(repoPath, 'actions', 'instances');
  await writeJsonFile(getActionInstancePath(repoPath, parsed.id), parsed);

  const existing = await listActionInstances(repoPath);
  const deduped = existing.filter((entry) => entry.id !== parsed.id);
  await saveActionIndex(repoPath, [parsed, ...deduped]);

  return parsed;
}

export async function loadActionInstance(
  repoPath: string,
  id: string,
): Promise<ActionInstance | null> {
  const instance = await readJsonFile<ActionInstance>(getActionInstancePath(repoPath, id));
  if (!instance) {
    return null;
  }
  return assertActionInstance(instance);
}

export async function listActionInstances(
  repoPath: string,
  limit?: number,
): Promise<ActionInstance[]> {
  const index = await readJsonFile<ActionInstanceIndexEntry[]>(getActionIndexPath(repoPath));
  const entries = Array.isArray(index) ? index : [];

  const loaded = await Promise.all(entries.map((entry) => loadActionInstance(repoPath, entry.id)));
  const instances = loaded.filter((entry): entry is ActionInstance => entry !== null);

  if (typeof limit === 'number') {
    return instances.slice(0, limit);
  }

  return instances;
}

export async function updateActionInstanceStatus(
  repoPath: string,
  id: string,
  patch: ActionInstancePatch,
): Promise<ActionInstance> {
  const existing = await loadActionInstance(repoPath, id);
  if (!existing) {
    throw new Error(`action instance not found: ${id}`);
  }

  const updated = assertActionInstance({
    ...existing,
    ...patch,
  });

  await saveActionInstance(repoPath, updated);
  return updated;
}
