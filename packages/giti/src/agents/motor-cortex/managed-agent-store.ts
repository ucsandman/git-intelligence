import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureOrganismDir, getOrganismPath, readJsonFile, writeJsonFile } from '../utils.js';

const STORE_FILENAME = 'managed-agents.json';

export interface ManagedAgentConfigFingerprint {
  name: string;
  description?: string;
  model: string;
  system: string;
  tools: unknown;
}

export interface StoredManagedAgent {
  agentId: string;
  agentName: string;
  agentVersion: number;
  environmentId: string;
  environmentName: string;
  configHash: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export function computeConfigHash(cfg: ManagedAgentConfigFingerprint): string {
  return createHash('sha256').update(stableStringify(cfg)).digest('hex');
}

function storePath(repoPath: string): string {
  return getOrganismPath(repoPath, STORE_FILENAME);
}

export async function loadStore(repoPath: string): Promise<StoredManagedAgent | null> {
  return readJsonFile<StoredManagedAgent>(storePath(repoPath));
}

export async function saveStore(repoPath: string, data: StoredManagedAgent): Promise<void> {
  await ensureOrganismDir(repoPath);
  await writeJsonFile(storePath(repoPath), data);
}

export async function clearStore(repoPath: string): Promise<void> {
  await fs.unlink(storePath(repoPath)).catch(() => {
    // File may not exist; swallow
  });
}

export function storeFilePath(repoPath: string): string {
  return path.normalize(storePath(repoPath));
}
