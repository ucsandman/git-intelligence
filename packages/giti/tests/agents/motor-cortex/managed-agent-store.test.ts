import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearStore,
  computeConfigHash,
  loadStore,
  saveStore,
  storeFilePath,
  type ManagedAgentConfigFingerprint,
  type StoredManagedAgent,
} from '../../../src/agents/motor-cortex/managed-agent-store.js';

let repoPath: string;

beforeEach(async () => {
  repoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-mc-store-'));
});

afterEach(async () => {
  await fs.rm(repoPath, { recursive: true, force: true }).catch(() => {});
});

function baseConfig(): ManagedAgentConfigFingerprint {
  return {
    name: 'giti-motor-cortex',
    description: 'test agent',
    model: 'claude-sonnet-4-6',
    system: 'system prompt',
    tools: [
      {
        type: 'agent_toolset_20260401',
        default_config: { enabled: true, permission_policy: { type: 'always_allow' } },
      },
    ],
  };
}

describe('computeConfigHash', () => {
  it('is stable across re-invocations for identical input', () => {
    const cfg = baseConfig();
    expect(computeConfigHash(cfg)).toBe(computeConfigHash(cfg));
  });

  it('is stable regardless of key insertion order (no silent cache-miss)', () => {
    const a: ManagedAgentConfigFingerprint = {
      name: 'x',
      description: 'd',
      model: 'm',
      system: 's',
      tools: [{ b: 2, a: 1, c: { y: 2, x: 1 } }],
    };
    const b: ManagedAgentConfigFingerprint = {
      tools: [{ c: { x: 1, y: 2 }, a: 1, b: 2 }],
      system: 's',
      model: 'm',
      description: 'd',
      name: 'x',
    };
    expect(computeConfigHash(a)).toBe(computeConfigHash(b));
  });

  it('changes when model changes', () => {
    const a = baseConfig();
    const b = { ...baseConfig(), model: 'claude-opus-4-6' };
    expect(computeConfigHash(a)).not.toBe(computeConfigHash(b));
  });

  it('changes when system prompt changes', () => {
    const a = baseConfig();
    const b = { ...baseConfig(), system: 'different prompt' };
    expect(computeConfigHash(a)).not.toBe(computeConfigHash(b));
  });
});

describe('persistent store', () => {
  it('round-trips a record through save/load', async () => {
    const record: StoredManagedAgent = {
      agentId: 'agent_abc',
      agentName: 'giti-motor-cortex',
      agentVersion: 3,
      environmentId: 'env_xyz',
      environmentName: 'giti-workspace',
      configHash: 'deadbeef',
      model: 'claude-sonnet-4-6',
      createdAt: '2026-04-13T00:00:00Z',
      updatedAt: '2026-04-13T00:00:00Z',
    };
    await saveStore(repoPath, record);
    expect(await loadStore(repoPath)).toEqual(record);
  });

  it('returns null when the store does not exist', async () => {
    expect(await loadStore(repoPath)).toBeNull();
  });

  it('clearStore removes the file and is idempotent', async () => {
    const record: StoredManagedAgent = {
      agentId: 'agent_abc',
      agentName: 'giti-motor-cortex',
      agentVersion: 1,
      environmentId: 'env_xyz',
      environmentName: 'giti-workspace',
      configHash: 'deadbeef',
      model: 'claude-sonnet-4-6',
      createdAt: '2026-04-13T00:00:00Z',
      updatedAt: '2026-04-13T00:00:00Z',
    };
    await saveStore(repoPath, record);
    await clearStore(repoPath);
    expect(await loadStore(repoPath)).toBeNull();
    // Second clear on a missing file should not throw
    await expect(clearStore(repoPath)).resolves.toBeUndefined();
  });

  it('writes to .organism/managed-agents.json', () => {
    expect(storeFilePath(repoPath)).toContain(path.join('.organism', 'managed-agents.json'));
  });
});
