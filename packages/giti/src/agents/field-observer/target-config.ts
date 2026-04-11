import fs from 'node:fs/promises';
import path from 'node:path';
import { loadOrganismConfig } from '../utils.js';
import type { FieldTarget } from './types.js';

/**
 * Load the field_targets array from organism.json, then filter to only
 * enabled entries whose path exists and appears to be a git repo.
 * Never throws — returns [] on any failure.
 */
export async function loadFieldTargets(repoPath: string): Promise<FieldTarget[]> {
  let config;
  try {
    config = await loadOrganismConfig(repoPath);
  } catch {
    return [];
  }

  const raw = config.field_targets ?? [];
  const valid: FieldTarget[] = [];

  for (const target of raw) {
    if (!target.enabled) continue;
    const ok = await isValidGitRepo(target.path);
    if (!ok) continue;
    valid.push(target);
  }

  return valid;
}

async function isValidGitRepo(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) return false;
    const gitStat = await fs.stat(path.join(targetPath, '.git'));
    return gitStat.isDirectory() || gitStat.isFile();
  } catch {
    return false;
  }
}
