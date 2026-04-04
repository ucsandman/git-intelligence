import type { OrganismStatus, CycleResult } from './types.js';
import { readJsonFile, getOrganismPath } from '../utils.js';
import { getSchedulerStatus } from './scheduler.js';
import * as safety from './safety.js';
import fs from 'node:fs/promises';

export async function getOrganismStatus(repoPath: string): Promise<OrganismStatus> {
  const scheduler = await getSchedulerStatus(repoPath);
  const cooldownData = await readJsonFile<{ until: string }>(getOrganismPath(repoPath, 'cooldown-until.json'));
  const failures = await safety.getConsecutiveFailures(repoPath);
  const apiUsage = await safety.getApiUsage(repoPath);
  const killSwitchActive = await safety.isKillSwitchActive(repoPath);
  const inCooldown = await safety.isInCooldown(repoPath);

  // Load cycle history
  const historyDir = getOrganismPath(repoPath, 'cycle-history');
  let cycleHistory: CycleResult[] = [];
  try {
    const entries = await fs.readdir(historyDir);
    for (const entry of entries.filter(e => e.endsWith('.json')).sort().reverse().slice(0, 10)) {
      const result = await readJsonFile<CycleResult>(getOrganismPath(repoPath, 'cycle-history', entry));
      if (result) cycleHistory.push(result);
    }
  } catch { /* no history yet */ }

  // Determine state
  let state: OrganismStatus['state'];
  if (killSwitchActive) state = 'stopped';
  else if (failures >= 3) state = 'paused';
  else if (inCooldown) state = 'cooldown';
  else if (scheduler) state = 'running';
  else state = 'stopped';

  // Calculate totals from history
  let totalCycles = 0;
  let totalMerged = 0;
  let totalRejected = 0;
  for (const cycle of cycleHistory) {
    totalCycles++;
    totalMerged += cycle.changes_merged;
    totalRejected += cycle.changes_rejected;
  }

  // Also check cycle counter for total cycles (more accurate)
  const cycleCounter = await readJsonFile<{ count: number }>(getOrganismPath(repoPath, 'cycle-counter.json'));
  totalCycles = cycleCounter?.count ?? totalCycles;

  return {
    state,
    last_cycle: cycleHistory[0] ?? null,
    next_cycle_at: scheduler ? new Date(new Date(scheduler.started_at).getTime() + scheduler.interval_ms).toISOString() : null,
    total_cycles: totalCycles,
    total_changes_merged: totalMerged,
    total_changes_rejected: totalRejected,
    total_api_tokens: apiUsage?.total_tokens ?? 0,
    api_budget: apiUsage?.budget ?? parseInt(process.env['GITI_API_BUDGET'] ?? '100000', 10),
    cooldown_until: cooldownData?.until ?? null,
    consecutive_failures: failures,
  };
}

export { runLifecycleCycle } from './cycle.js';
export { startScheduler, stopScheduler, getSchedulerStatus } from './scheduler.js';
