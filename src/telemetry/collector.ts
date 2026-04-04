import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { TelemetryEvent } from './types.js';
import { getUserConfig, appendEvent } from './store.js';
import { buildRepoCharacteristics } from './anonymizer.js';
import { createGitClient } from '../utils/git.js';
import { readJsonFile } from '../agents/utils.js';

export async function recordCommandTelemetry(
  repoPath: string,
  command: string,
  flags: string[],
  executionMs: number,
  exitCode: number,
  errorType?: string,
): Promise<void> {
  try {
    const config = await getUserConfig();
    if (!config.enabled) return;

    const git = createGitClient(repoPath);
    const characteristics = await buildRepoCharacteristics(git, repoPath);

    // Read version from package.json
    const pkg = await readJsonFile<{ version?: string }>(path.join(repoPath, 'package.json'));
    const version = pkg?.version ?? '0.0.0';

    const event: TelemetryEvent = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      giti_version: version,
      node_version: process.version,
      os_platform: os.platform(),
      command,
      flags_used: flags,
      execution_time_ms: executionMs,
      exit_code: exitCode,
      error_type: errorType,
      repo_characteristics: characteristics,
    };

    await appendEvent(repoPath, event);
  } catch {
    // Telemetry must NEVER crash the main command — silently swallow all errors
  }
}

export function extractFlags(options: Record<string, unknown>): string[] {
  const flags: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    if (value === true) flags.push(`--${key}`);
    else if (typeof value === 'string') flags.push(`--${key}=${value}`);
  }
  return flags;
}
