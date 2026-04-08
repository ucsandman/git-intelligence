import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runHeartbeat } from '../../../src/agents/orchestrator/heartbeat.js';

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-heartbeat-'));
  tmpDirs.push(dir);
  return dir;
}

async function writeOrganismFile(repoPath: string, filename: string, data: unknown): Promise<void> {
  const dir = path.join(repoPath, '.organism');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), JSON.stringify(data), 'utf-8');
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('Heartbeat Monitor', () => {
  it('returns healthy when no organism state exists', async () => {
    const tmp = await makeTmpDir();
    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('healthy');
    expect(report.checks).toHaveLength(5);
    expect(report.timestamp).toBeTruthy();
    for (const check of report.checks) {
      expect(check.status).toBe('healthy');
    }
  });

  it('detects stale cycle lock (>2hrs) as critical', async () => {
    const tmp = await makeTmpDir();
    const staleTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    await writeOrganismFile(tmp, 'active-cycle.json', { started: staleTime, cycle: 5 });

    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('critical');
    const lockCheck = report.checks.find(c => c.name === 'cycle-lock');
    expect(lockCheck).toBeDefined();
    expect(lockCheck!.status).toBe('critical');
    expect(lockCheck!.severity).toBe('critical');
  });

  it('detects warning-level cycle lock (1-2hrs) as degraded', async () => {
    const tmp = await makeTmpDir();
    const warningTime = new Date(Date.now() - 90 * 60 * 1000).toISOString(); // 1.5h ago
    await writeOrganismFile(tmp, 'active-cycle.json', { started: warningTime, cycle: 3 });

    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('degraded');
    const lockCheck = report.checks.find(c => c.name === 'cycle-lock');
    expect(lockCheck).toBeDefined();
    expect(lockCheck!.status).toBe('degraded');
  });

  it('detects 3+ consecutive failures as critical', async () => {
    const tmp = await makeTmpDir();
    await writeOrganismFile(tmp, 'consecutive-failures.json', { count: 3 });

    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('critical');
    const failCheck = report.checks.find(c => c.name === 'consecutive-failures');
    expect(failCheck).toBeDefined();
    expect(failCheck!.status).toBe('critical');
    expect(failCheck!.severity).toBe('critical');
  });

  it('detects 2 consecutive failures as degraded', async () => {
    const tmp = await makeTmpDir();
    await writeOrganismFile(tmp, 'consecutive-failures.json', { count: 2 });

    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('degraded');
    const failCheck = report.checks.find(c => c.name === 'consecutive-failures');
    expect(failCheck).toBeDefined();
    expect(failCheck!.status).toBe('degraded');
  });

  it('detects active cooldown as degraded', async () => {
    const tmp = await makeTmpDir();
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now
    await writeOrganismFile(tmp, 'cooldown-until.json', { until: futureTime });

    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('degraded');
    const cooldownCheck = report.checks.find(c => c.name === 'cooldown');
    expect(cooldownCheck).toBeDefined();
    expect(cooldownCheck!.status).toBe('degraded');
    expect(cooldownCheck!.severity).toBe('warning');
  });

  it('detects expired cooldown as healthy', async () => {
    const tmp = await makeTmpDir();
    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    await writeOrganismFile(tmp, 'cooldown-until.json', { until: pastTime });

    const report = await runHeartbeat(tmp);

    const cooldownCheck = report.checks.find(c => c.name === 'cooldown');
    expect(cooldownCheck).toBeDefined();
    expect(cooldownCheck!.status).toBe('healthy');
  });

  it('detects high API budget usage (>=80%) as degraded', async () => {
    const tmp = await makeTmpDir();
    const currentMonth = new Date().toISOString().slice(0, 7);
    await writeOrganismFile(tmp, 'api-usage.json', {
      total_tokens: 85000,
      monthly_tokens: 85000,
      month: currentMonth,
      budget: 100000,
    });

    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('degraded');
    const budgetCheck = report.checks.find(c => c.name === 'api-budget');
    expect(budgetCheck).toBeDefined();
    expect(budgetCheck!.status).toBe('degraded');
    expect(budgetCheck!.severity).toBe('warning');
  });

  it('detects exceeded API budget (>=100%) as critical', async () => {
    const tmp = await makeTmpDir();
    const currentMonth = new Date().toISOString().slice(0, 7);
    await writeOrganismFile(tmp, 'api-usage.json', {
      total_tokens: 100000,
      monthly_tokens: 100000,
      month: currentMonth,
      budget: 100000,
    });

    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('critical');
    const budgetCheck = report.checks.find(c => c.name === 'api-budget');
    expect(budgetCheck).toBeDefined();
    expect(budgetCheck!.status).toBe('critical');
  });

  it('overall is degraded when worst check is degraded', async () => {
    const tmp = await makeTmpDir();
    // Only set cooldown (degraded, warning severity) — no critical checks
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await writeOrganismFile(tmp, 'cooldown-until.json', { until: futureTime });

    const report = await runHeartbeat(tmp);

    expect(report.overall).toBe('degraded');
    // Verify no check is critical
    const criticalChecks = report.checks.filter(c => c.status === 'critical');
    expect(criticalChecks).toHaveLength(0);
    // At least one degraded
    const degradedChecks = report.checks.filter(c => c.status === 'degraded');
    expect(degradedChecks.length).toBeGreaterThanOrEqual(1);
  });
});
