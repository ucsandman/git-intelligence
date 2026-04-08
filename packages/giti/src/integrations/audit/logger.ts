import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuditEntry } from './types.js';

const ORGANISM_DIR = '.organism';
const AUDIT_LOG_FILE = 'audit-log.jsonl';

function getAuditLogPath(repoPath: string): string {
  return path.join(repoPath, ORGANISM_DIR, AUDIT_LOG_FILE);
}

export async function logAction(
  repoPath: string,
  entry: Omit<AuditEntry, 'timestamp'>,
): Promise<void> {
  const organismDir = path.join(repoPath, ORGANISM_DIR);
  await fs.mkdir(organismDir, { recursive: true });

  const full: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(full) + '\n';
  await fs.appendFile(getAuditLogPath(repoPath), line, 'utf-8');
}

export interface QueryOptions {
  agent?: string;
  action?: string;
  since?: string;
  limit?: number;
}

export async function queryAuditLog(
  repoPath: string,
  options?: QueryOptions,
): Promise<AuditEntry[]> {
  const logPath = getAuditLogPath(repoPath);

  let content: string;
  try {
    content = await fs.readFile(logPath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content.trim().split('\n').filter(Boolean);
  let entries: AuditEntry[] = lines.map(line => JSON.parse(line) as AuditEntry);

  if (options?.agent) {
    entries = entries.filter(e => e.agent === options.agent);
  }
  if (options?.action) {
    entries = entries.filter(e => e.action === options.action);
  }
  if (options?.since) {
    const since = options.since;
    entries = entries.filter(e => e.timestamp >= since);
  }
  if (options?.limit !== undefined) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

export interface AuditStats {
  total_entries: number;
  by_agent: Record<string, number>;
  by_outcome: Record<string, number>;
}

export async function getAuditStats(repoPath: string): Promise<AuditStats> {
  const entries = await queryAuditLog(repoPath);

  const byAgent: Record<string, number> = {};
  const byOutcome: Record<string, number> = { success: 0, failure: 0, skipped: 0 };

  for (const entry of entries) {
    byAgent[entry.agent] = (byAgent[entry.agent] ?? 0) + 1;
    byOutcome[entry.outcome] = (byOutcome[entry.outcome] ?? 0) + 1;
  }

  return {
    total_entries: entries.length,
    by_agent: byAgent,
    by_outcome: byOutcome,
  };
}
