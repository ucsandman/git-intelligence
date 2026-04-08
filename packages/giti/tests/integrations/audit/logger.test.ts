import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { logAction, queryAuditLog, getAuditStats } from '../../../src/integrations/audit/index.js';
import type { AuditEntry } from '../../../src/integrations/audit/index.js';

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-audit-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('logAction', () => {
  it('creates audit-log.jsonl and appends entry with timestamp', async () => {
    const tmp = await makeTmpDir();
    await logAction(tmp, {
      agent: 'motor-cortex',
      action: 'generate-code',
      target: 'src/utils.ts',
      outcome: 'success',
    });

    const logPath = path.join(tmp, '.organism', 'audit-log.jsonl');
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const entry: AuditEntry = JSON.parse(lines[0]!);
    expect(entry.agent).toBe('motor-cortex');
    expect(entry.action).toBe('generate-code');
    expect(entry.target).toBe('src/utils.ts');
    expect(entry.outcome).toBe('success');
    expect(entry.timestamp).toBeDefined();
    // Verify timestamp is a valid ISO string
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('appends multiple entries on separate lines', async () => {
    const tmp = await makeTmpDir();
    await logAction(tmp, {
      agent: 'immune-system',
      action: 'review-branch',
      target: 'feature/add-login',
      outcome: 'success',
    });
    await logAction(tmp, {
      agent: 'sensory-cortex',
      action: 'collect-stats',
      target: 'repo',
      outcome: 'failure',
    });

    const logPath = path.join(tmp, '.organism', 'audit-log.jsonl');
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const entry1: AuditEntry = JSON.parse(lines[0]!);
    const entry2: AuditEntry = JSON.parse(lines[1]!);
    expect(entry1.agent).toBe('immune-system');
    expect(entry2.agent).toBe('sensory-cortex');
  });

  it('includes optional fields (reasoning, duration_ms, metadata)', async () => {
    const tmp = await makeTmpDir();
    await logAction(tmp, {
      agent: 'motor-cortex',
      action: 'generate-code',
      target: 'src/index.ts',
      outcome: 'success',
      reasoning: 'High priority work item',
      duration_ms: 1234,
      metadata: { tokens_used: 500, model: 'claude-3' },
    });

    const logPath = path.join(tmp, '.organism', 'audit-log.jsonl');
    const content = await fs.readFile(logPath, 'utf-8');
    const entry: AuditEntry = JSON.parse(content.trim());
    expect(entry.reasoning).toBe('High priority work item');
    expect(entry.duration_ms).toBe(1234);
    expect(entry.metadata).toEqual({ tokens_used: 500, model: 'claude-3' });
  });
});

describe('queryAuditLog', () => {
  it('returns all entries when no filters', async () => {
    const tmp = await makeTmpDir();
    await logAction(tmp, { agent: 'a', action: 'x', target: 't1', outcome: 'success' });
    await logAction(tmp, { agent: 'b', action: 'y', target: 't2', outcome: 'failure' });
    await logAction(tmp, { agent: 'c', action: 'z', target: 't3', outcome: 'skipped' });

    const entries = await queryAuditLog(tmp);
    expect(entries).toHaveLength(3);
  });

  it('filters by agent', async () => {
    const tmp = await makeTmpDir();
    await logAction(tmp, { agent: 'motor-cortex', action: 'build', target: 't1', outcome: 'success' });
    await logAction(tmp, { agent: 'immune-system', action: 'review', target: 't2', outcome: 'success' });
    await logAction(tmp, { agent: 'motor-cortex', action: 'build', target: 't3', outcome: 'failure' });

    const entries = await queryAuditLog(tmp, { agent: 'motor-cortex' });
    expect(entries).toHaveLength(2);
    expect(entries.every(e => e.agent === 'motor-cortex')).toBe(true);
  });

  it('filters by action', async () => {
    const tmp = await makeTmpDir();
    await logAction(tmp, { agent: 'a', action: 'build', target: 't1', outcome: 'success' });
    await logAction(tmp, { agent: 'b', action: 'review', target: 't2', outcome: 'success' });
    await logAction(tmp, { agent: 'c', action: 'build', target: 't3', outcome: 'success' });

    const entries = await queryAuditLog(tmp, { action: 'build' });
    expect(entries).toHaveLength(2);
    expect(entries.every(e => e.action === 'build')).toBe(true);
  });

  it('respects limit', async () => {
    const tmp = await makeTmpDir();
    await logAction(tmp, { agent: 'a', action: 'x', target: 't1', outcome: 'success' });
    await logAction(tmp, { agent: 'b', action: 'y', target: 't2', outcome: 'success' });
    await logAction(tmp, { agent: 'c', action: 'z', target: 't3', outcome: 'success' });

    const entries = await queryAuditLog(tmp, { limit: 2 });
    expect(entries).toHaveLength(2);
  });

  it('returns empty array when no log file exists', async () => {
    const tmp = await makeTmpDir();
    const entries = await queryAuditLog(tmp);
    expect(entries).toEqual([]);
  });
});

describe('getAuditStats', () => {
  it('returns counts by agent and outcome', async () => {
    const tmp = await makeTmpDir();
    await logAction(tmp, { agent: 'motor-cortex', action: 'build', target: 't1', outcome: 'success' });
    await logAction(tmp, { agent: 'motor-cortex', action: 'build', target: 't2', outcome: 'failure' });
    await logAction(tmp, { agent: 'immune-system', action: 'review', target: 't3', outcome: 'success' });
    await logAction(tmp, { agent: 'immune-system', action: 'review', target: 't4', outcome: 'skipped' });
    await logAction(tmp, { agent: 'sensory-cortex', action: 'scan', target: 't5', outcome: 'success' });

    const stats = await getAuditStats(tmp);
    expect(stats.total_entries).toBe(5);
    expect(stats.by_agent).toEqual({
      'motor-cortex': 2,
      'immune-system': 2,
      'sensory-cortex': 1,
    });
    expect(stats.by_outcome).toEqual({
      success: 3,
      failure: 1,
      skipped: 1,
    });
  });

  it('returns zeroes when no log exists', async () => {
    const tmp = await makeTmpDir();
    const stats = await getAuditStats(tmp);
    expect(stats.total_entries).toBe(0);
    expect(stats.by_agent).toEqual({});
    expect(stats.by_outcome).toEqual({ success: 0, failure: 0, skipped: 0 });
  });
});
