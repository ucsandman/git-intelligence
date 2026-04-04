import fs from 'node:fs/promises';
import { readJsonFile, writeJsonFile, getOrganismPath, ensureOrganismDir } from '../utils.js';

// === Kill Switch ===
// Presence of .organism/kill-switch file means organism is stopped

export async function isKillSwitchActive(repoPath: string): Promise<boolean> {
  try {
    await fs.access(getOrganismPath(repoPath, 'kill-switch'));
    return true;
  } catch {
    return false;
  }
}

export async function activateKillSwitch(repoPath: string): Promise<void> {
  await ensureOrganismDir(repoPath);
  await fs.writeFile(getOrganismPath(repoPath, 'kill-switch'), '', 'utf-8');
}

export async function deactivateKillSwitch(repoPath: string): Promise<void> {
  try {
    await fs.unlink(getOrganismPath(repoPath, 'kill-switch'));
  } catch {
    /* not present */
  }
}

// === Cooldown ===
// .organism/cooldown-until.json: { until: ISO_string }

export async function isInCooldown(repoPath: string): Promise<boolean> {
  const data = await readJsonFile<{ until: string }>(getOrganismPath(repoPath, 'cooldown-until.json'));
  if (!data?.until) return false;
  return new Date(data.until).getTime() > Date.now();
}

export async function setCooldown(repoPath: string, durationMs: number): Promise<void> {
  await ensureOrganismDir(repoPath);
  const until = new Date(Date.now() + durationMs).toISOString();
  await writeJsonFile(getOrganismPath(repoPath, 'cooldown-until.json'), { until });
}

export async function clearCooldown(repoPath: string): Promise<void> {
  try {
    await fs.unlink(getOrganismPath(repoPath, 'cooldown-until.json'));
  } catch {
    /* ok */
  }
}

// === Cycle Lock ===
// .organism/active-cycle.json: { started: ISO_string, cycle: number }
// Stale if older than 2 hours

const STALE_LOCK_MS = 2 * 60 * 60 * 1000;

export async function acquireCycleLock(repoPath: string): Promise<number> {
  await ensureOrganismDir(repoPath);
  const lockPath = getOrganismPath(repoPath, 'active-cycle.json');
  const existing = await readJsonFile<{ started: string; cycle: number }>(lockPath);

  if (existing) {
    const age = Date.now() - new Date(existing.started).getTime();
    if (age < STALE_LOCK_MS) {
      throw new Error(`Cycle lock held since ${existing.started} (cycle ${existing.cycle}). Another cycle is running.`);
    }
    // Stale lock — override it
  }

  const cycle = await getNextCycleNumber(repoPath);
  await writeJsonFile(lockPath, { started: new Date().toISOString(), cycle });
  return cycle;
}

export async function releaseCycleLock(repoPath: string): Promise<void> {
  try {
    await fs.unlink(getOrganismPath(repoPath, 'active-cycle.json'));
  } catch {
    /* ok */
  }
}

async function getNextCycleNumber(repoPath: string): Promise<number> {
  const data = await readJsonFile<{ count: number }>(getOrganismPath(repoPath, 'cycle-counter.json'));
  const next = (data?.count ?? 0) + 1;
  await writeJsonFile(getOrganismPath(repoPath, 'cycle-counter.json'), { count: next });
  return next;
}

// === Consecutive Failures ===
// .organism/consecutive-failures.json: { count: number }

export async function getConsecutiveFailures(repoPath: string): Promise<number> {
  const data = await readJsonFile<{ count: number }>(getOrganismPath(repoPath, 'consecutive-failures.json'));
  return data?.count ?? 0;
}

export async function incrementFailures(repoPath: string): Promise<number> {
  const current = await getConsecutiveFailures(repoPath);
  const next = current + 1;
  await writeJsonFile(getOrganismPath(repoPath, 'consecutive-failures.json'), { count: next });
  return next;
}

export async function resetFailures(repoPath: string): Promise<void> {
  await writeJsonFile(getOrganismPath(repoPath, 'consecutive-failures.json'), { count: 0 });
}

// === API Budget ===
// .organism/api-usage.json: { total_tokens, monthly_tokens, month, budget }

interface ApiUsage {
  total_tokens: number;
  monthly_tokens: number;
  month: string; // YYYY-MM format
  budget: number;
}

export async function checkApiBudget(repoPath: string): Promise<boolean> {
  const usage = await readJsonFile<ApiUsage>(getOrganismPath(repoPath, 'api-usage.json'));
  if (!usage) return true; // No tracking yet = no limit
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyTokens = usage.month === currentMonth ? usage.monthly_tokens : 0;
  return monthlyTokens < usage.budget;
}

export async function recordApiUsage(repoPath: string, tokens: number): Promise<void> {
  await ensureOrganismDir(repoPath);
  const usagePath = getOrganismPath(repoPath, 'api-usage.json');
  const existing = await readJsonFile<ApiUsage>(usagePath);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const budget = parseInt(process.env['GITI_API_BUDGET'] ?? '100000', 10);

  const usage: ApiUsage = {
    total_tokens: (existing?.total_tokens ?? 0) + tokens,
    monthly_tokens: (existing?.month === currentMonth ? existing.monthly_tokens : 0) + tokens,
    month: currentMonth,
    budget,
  };
  await writeJsonFile(usagePath, usage);
}

export async function getApiUsage(repoPath: string): Promise<ApiUsage | null> {
  return readJsonFile<ApiUsage>(getOrganismPath(repoPath, 'api-usage.json'));
}
