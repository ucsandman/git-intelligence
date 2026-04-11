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
  } catch (error) {
    // Distinguish "no organism.json" from "malformed organism.json":
    // the former is a legitimate pre-init state; the latter should leave
    // a breadcrumb so operators notice the silent empty.
    const configPath = path.join(repoPath, 'organism.json');
    try {
      await fs.access(configPath);
      // File exists but failed to load → malformed. Re-read locally so we
      // can surface the real parse error rather than the generic "not found"
      // message that loadOrganismConfig produces via readJsonFile.
      let realError: string;
      try {
        const raw = await fs.readFile(configPath, 'utf-8');
        JSON.parse(raw);
        realError = error instanceof Error ? error.message : String(error);
      } catch (parseError) {
        realError = parseError instanceof Error ? parseError.message : String(parseError);
      }
      console.error(`[field-observer] failed to load ${configPath}: ${realError}`);
    } catch {
      // File genuinely doesn't exist. Silent return is correct.
    }
    return [];
  }

  const raw = config.field_targets ?? [];
  if (!Array.isArray(raw)) return [];
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
