import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  loadActionInstance,
  listActionInstances,
  saveActionInstance,
  updateActionInstanceStatus,
} from '../../../src/agents/actions/history.js';
import type { ActionInstance } from '../../../src/agents/actions/types.js';

const tmpDirs: string[] = [];

async function makeTmpRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-actions-history-'));
  tmpDirs.push(dir);
  return dir;
}

function makeInstance(id: string, status: ActionInstance['status'], completedAt?: string): ActionInstance {
  return {
    id,
    template_id: 'regression-cluster-draft-stabilization-plan',
    template_version: 1,
    status,
    bound_inputs: {
      repo_path: '/repo',
    },
    step_results: [],
    completed_at: completedAt,
  };
}

afterEach(async () => {
  await Promise.all(tmpDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tmpDirs.length = 0;
});

describe('action history', () => {
  it('saves an action instance under .organism/actions/instances', async () => {
    const repoPath = await makeTmpRepo();
    const instance = makeInstance('instance-1', 'planned');

    await saveActionInstance(repoPath, instance);

    const saved = JSON.parse(
      await fs.readFile(
        path.join(repoPath, '.organism', 'actions', 'instances', 'instance-1.json'),
        'utf-8',
      ),
    );
    expect(saved).toEqual(instance);
  });

  it('loads a saved action instance', async () => {
    const repoPath = await makeTmpRepo();
    const instance = makeInstance('instance-2', 'running');

    await saveActionInstance(repoPath, instance);

    await expect(loadActionInstance(repoPath, 'instance-2')).resolves.toEqual(instance);
  });

  it('returns null for a missing action instance', async () => {
    const repoPath = await makeTmpRepo();

    await expect(loadActionInstance(repoPath, 'missing')).resolves.toBeNull();
  });

  it('lists saved action instances newest first', async () => {
    const repoPath = await makeTmpRepo();
    await saveActionInstance(repoPath, makeInstance('oldest', 'succeeded', '2026-04-10T00:00:00.000Z'));
    await saveActionInstance(repoPath, makeInstance('newest', 'failed', '2026-04-10T00:05:00.000Z'));

    const instances = await listActionInstances(repoPath);

    expect(instances.map((instance) => instance.id)).toEqual(['newest', 'oldest']);
  });

  it('updates an action instance status and persists the patch', async () => {
    const repoPath = await makeTmpRepo();
    await saveActionInstance(repoPath, makeInstance('instance-3', 'planned'));

    const updated = await updateActionInstanceStatus(repoPath, 'instance-3', {
      status: 'approved',
      failure_reason: 'none',
    });

    expect(updated.status).toBe('approved');
    await expect(loadActionInstance(repoPath, 'instance-3')).resolves.toEqual(updated);
  });
});
