import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  isKillSwitchActive,
  activateKillSwitch,
  deactivateKillSwitch,
  isInCooldown,
  setCooldown,
  clearCooldown,
  acquireCycleLock,
  releaseCycleLock,
  getConsecutiveFailures,
  incrementFailures,
  resetFailures,
  checkApiBudget,
  recordApiUsage,
  getApiUsage,
} from '../../../src/agents/orchestrator/safety.js';

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-safety-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

// === Kill Switch ===

describe('Kill Switch', () => {
  it('isKillSwitchActive returns false when no kill-switch file', async () => {
    const tmp = await makeTmpDir();
    expect(await isKillSwitchActive(tmp)).toBe(false);
  });

  it('isKillSwitchActive returns true after activateKillSwitch', async () => {
    const tmp = await makeTmpDir();
    await activateKillSwitch(tmp);
    expect(await isKillSwitchActive(tmp)).toBe(true);
  });

  it('isKillSwitchActive returns false after deactivateKillSwitch', async () => {
    const tmp = await makeTmpDir();
    await activateKillSwitch(tmp);
    expect(await isKillSwitchActive(tmp)).toBe(true);
    await deactivateKillSwitch(tmp);
    expect(await isKillSwitchActive(tmp)).toBe(false);
  });

  it('deactivateKillSwitch is safe when no kill-switch file exists', async () => {
    const tmp = await makeTmpDir();
    await expect(deactivateKillSwitch(tmp)).resolves.toBeUndefined();
  });
});

// === Cooldown ===

describe('Cooldown', () => {
  it('isInCooldown returns false when no cooldown file', async () => {
    const tmp = await makeTmpDir();
    expect(await isInCooldown(tmp)).toBe(false);
  });

  it('isInCooldown returns true when cooldown is in the future', async () => {
    const tmp = await makeTmpDir();
    await setCooldown(tmp, 60_000); // 1 minute from now
    expect(await isInCooldown(tmp)).toBe(true);
  });

  it('isInCooldown returns false when cooldown is in the past', async () => {
    const tmp = await makeTmpDir();
    // Write a cooldown that already expired
    const orgDir = path.join(tmp, '.organism');
    await fs.mkdir(orgDir, { recursive: true });
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    await fs.writeFile(
      path.join(orgDir, 'cooldown-until.json'),
      JSON.stringify({ until: pastDate }),
      'utf-8',
    );
    expect(await isInCooldown(tmp)).toBe(false);
  });

  it('setCooldown creates a file with correct expiry', async () => {
    const tmp = await makeTmpDir();
    const before = Date.now();
    await setCooldown(tmp, 30_000);
    const after = Date.now();

    const content = await fs.readFile(
      path.join(tmp, '.organism', 'cooldown-until.json'),
      'utf-8',
    );
    const data = JSON.parse(content) as { until: string };
    const until = new Date(data.until).getTime();

    expect(until).toBeGreaterThanOrEqual(before + 30_000);
    expect(until).toBeLessThanOrEqual(after + 30_000);
  });

  it('clearCooldown removes the cooldown file', async () => {
    const tmp = await makeTmpDir();
    await setCooldown(tmp, 60_000);
    expect(await isInCooldown(tmp)).toBe(true);
    await clearCooldown(tmp);
    expect(await isInCooldown(tmp)).toBe(false);
  });

  it('clearCooldown is safe when no cooldown file exists', async () => {
    const tmp = await makeTmpDir();
    await expect(clearCooldown(tmp)).resolves.toBeUndefined();
  });
});

// === Cycle Lock ===

describe('Cycle Lock', () => {
  it('acquireCycleLock succeeds on empty dir and returns cycle 1', async () => {
    const tmp = await makeTmpDir();
    const cycle = await acquireCycleLock(tmp);
    expect(cycle).toBe(1);
  });

  it('acquireCycleLock returns incrementing cycle numbers', async () => {
    const tmp = await makeTmpDir();
    const c1 = await acquireCycleLock(tmp);
    await releaseCycleLock(tmp);
    const c2 = await acquireCycleLock(tmp);
    await releaseCycleLock(tmp);
    const c3 = await acquireCycleLock(tmp);
    expect(c1).toBe(1);
    expect(c2).toBe(2);
    expect(c3).toBe(3);
  });

  it('acquireCycleLock throws if lock exists and is not stale', async () => {
    const tmp = await makeTmpDir();
    await acquireCycleLock(tmp);
    await expect(acquireCycleLock(tmp)).rejects.toThrow('Cycle lock held since');
  });

  it('acquireCycleLock succeeds if lock is stale (>2h)', async () => {
    const tmp = await makeTmpDir();
    // Create a stale lock manually
    const orgDir = path.join(tmp, '.organism');
    await fs.mkdir(orgDir, { recursive: true });
    const staleTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    await fs.writeFile(
      path.join(orgDir, 'active-cycle.json'),
      JSON.stringify({ started: staleTime, cycle: 99 }),
      'utf-8',
    );
    // Also set up cycle counter so next is deterministic
    await fs.writeFile(
      path.join(orgDir, 'cycle-counter.json'),
      JSON.stringify({ count: 99 }),
      'utf-8',
    );

    const cycle = await acquireCycleLock(tmp);
    expect(cycle).toBe(100);
  });

  it('releaseCycleLock removes the lock file', async () => {
    const tmp = await makeTmpDir();
    await acquireCycleLock(tmp);
    await releaseCycleLock(tmp);
    // Should be able to acquire again immediately
    const cycle = await acquireCycleLock(tmp);
    expect(cycle).toBe(2);
  });

  it('releaseCycleLock is safe when no lock file exists', async () => {
    const tmp = await makeTmpDir();
    await expect(releaseCycleLock(tmp)).resolves.toBeUndefined();
  });
});

// === Consecutive Failures ===

describe('Consecutive Failures', () => {
  it('getConsecutiveFailures starts at 0', async () => {
    const tmp = await makeTmpDir();
    expect(await getConsecutiveFailures(tmp)).toBe(0);
  });

  it('incrementFailures increments the counter', async () => {
    const tmp = await makeTmpDir();
    expect(await incrementFailures(tmp)).toBe(1);
    expect(await incrementFailures(tmp)).toBe(2);
    expect(await incrementFailures(tmp)).toBe(3);
    expect(await getConsecutiveFailures(tmp)).toBe(3);
  });

  it('resetFailures goes back to 0', async () => {
    const tmp = await makeTmpDir();
    await incrementFailures(tmp);
    await incrementFailures(tmp);
    expect(await getConsecutiveFailures(tmp)).toBe(2);
    await resetFailures(tmp);
    expect(await getConsecutiveFailures(tmp)).toBe(0);
  });
});

// === API Budget ===

describe('API Budget', () => {
  beforeEach(() => {
    // Set a known budget for testing
    vi.stubEnv('GITI_API_BUDGET', '1000');
  });

  it('checkApiBudget returns true with no tracking file', async () => {
    const tmp = await makeTmpDir();
    expect(await checkApiBudget(tmp)).toBe(true);
  });

  it('recordApiUsage tracks tokens correctly', async () => {
    const tmp = await makeTmpDir();
    await recordApiUsage(tmp, 100);
    const usage = await getApiUsage(tmp);
    expect(usage).not.toBeNull();
    expect(usage!.total_tokens).toBe(100);
    expect(usage!.monthly_tokens).toBe(100);
  });

  it('recordApiUsage accumulates tokens', async () => {
    const tmp = await makeTmpDir();
    await recordApiUsage(tmp, 100);
    await recordApiUsage(tmp, 250);
    const usage = await getApiUsage(tmp);
    expect(usage!.total_tokens).toBe(350);
    expect(usage!.monthly_tokens).toBe(350);
  });

  it('checkApiBudget returns true when under budget', async () => {
    const tmp = await makeTmpDir();
    await recordApiUsage(tmp, 500);
    expect(await checkApiBudget(tmp)).toBe(true);
  });

  it('checkApiBudget returns false when over budget', async () => {
    const tmp = await makeTmpDir();
    await recordApiUsage(tmp, 1500);
    expect(await checkApiBudget(tmp)).toBe(false);
  });

  it('monthly tokens reset when month changes', async () => {
    const tmp = await makeTmpDir();
    // Write usage data for a previous month
    const orgDir = path.join(tmp, '.organism');
    await fs.mkdir(orgDir, { recursive: true });
    await fs.writeFile(
      path.join(orgDir, 'api-usage.json'),
      JSON.stringify({
        total_tokens: 5000,
        monthly_tokens: 5000,
        month: '2020-01', // far in the past
        budget: 1000,
      }),
      'utf-8',
    );

    // Budget check should pass since it's a new month
    expect(await checkApiBudget(tmp)).toBe(true);

    // Recording new usage should start fresh monthly count
    await recordApiUsage(tmp, 200);
    const usage = await getApiUsage(tmp);
    expect(usage!.total_tokens).toBe(5200); // cumulative total
    expect(usage!.monthly_tokens).toBe(200); // fresh for new month
  });

  it('getApiUsage returns null when no tracking file', async () => {
    const tmp = await makeTmpDir();
    expect(await getApiUsage(tmp)).toBeNull();
  });
});
