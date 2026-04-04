import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { TelemetryEvent, TelemetryConfig } from './types.js';
import { ensureOrganismDir, getOrganismPath } from '../agents/utils.js';

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.giti');
const EVENTS_SUBPATH = path.join('telemetry', 'events.jsonl');

export async function getUserConfig(configDir?: string): Promise<TelemetryConfig> {
  const dir = configDir ?? DEFAULT_CONFIG_DIR;
  const file = path.join(dir, 'config.json');
  try {
    const content = await fs.readFile(file, 'utf-8');
    return JSON.parse(content) as TelemetryConfig;
  } catch {
    return { enabled: false, first_prompt_shown: false };
  }
}

export async function setUserConfig(config: TelemetryConfig, configDir?: string): Promise<void> {
  const dir = configDir ?? DEFAULT_CONFIG_DIR;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
}

export async function appendEvent(repoPath: string, event: TelemetryEvent): Promise<void> {
  await ensureOrganismDir(repoPath, 'telemetry');
  const filePath = getOrganismPath(repoPath, EVENTS_SUBPATH);
  await fs.appendFile(filePath, JSON.stringify(event) + '\n', 'utf-8');
}

export async function readEvents(repoPath: string): Promise<TelemetryEvent[]> {
  try {
    const content = await fs.readFile(getOrganismPath(repoPath, EVENTS_SUBPATH), 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TelemetryEvent);
  } catch {
    return [];
  }
}

export async function getRecentEvents(repoPath: string, count: number): Promise<TelemetryEvent[]> {
  const all = await readEvents(repoPath);
  return all.slice(-count);
}

export async function clearEvents(repoPath: string): Promise<void> {
  try {
    await fs.unlink(getOrganismPath(repoPath, EVENTS_SUBPATH));
  } catch {
    /* file may not exist */
  }
}
