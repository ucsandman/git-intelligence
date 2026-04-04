import type { SchedulerConfig } from './types.js';
import { readJsonFile, writeJsonFile, getOrganismPath, ensureOrganismDir } from '../utils.js';
import { runLifecycleCycle } from './cycle.js';
import * as safety from './safety.js';
import fs from 'node:fs/promises';

export async function startScheduler(repoPath: string, intervalMs: number): Promise<void> {
  // Deactivate any previous kill switch
  await safety.deactivateKillSwitch(repoPath);

  const config: SchedulerConfig = {
    pid: process.pid,
    interval_ms: intervalMs,
    started_at: new Date().toISOString(),
    repo_path: repoPath,
  };
  await ensureOrganismDir(repoPath);
  await writeJsonFile(getOrganismPath(repoPath, 'scheduler.json'), config);

  console.log(`Organism scheduler started (PID ${process.pid}, interval ${intervalMs}ms)`);

  // Run first cycle immediately
  try {
    await runLifecycleCycle({ repoPath, supervised: false });
  } catch (error) {
    console.error('Initial cycle failed:', error);
  }

  // Schedule recurring
  const interval = setInterval(async () => {
    if (await safety.isKillSwitchActive(repoPath)) {
      console.log('Kill switch active. Stopping scheduler.');
      clearInterval(interval);
      try { await fs.unlink(getOrganismPath(repoPath, 'scheduler.json')); } catch { /* ok */ }
      return;
    }
    try {
      await runLifecycleCycle({ repoPath, supervised: false });
    } catch (error) {
      console.error('Cycle failed:', error);
    }
  }, intervalMs);

  // Keep process alive
  process.on('SIGINT', async () => {
    clearInterval(interval);
    await safety.activateKillSwitch(repoPath);
    try { await fs.unlink(getOrganismPath(repoPath, 'scheduler.json')); } catch { /* ok */ }
    console.log('Organism stopped.');
    process.exit(0);
  });
}

export async function stopScheduler(repoPath: string): Promise<void> {
  await safety.activateKillSwitch(repoPath);
  try { await fs.unlink(getOrganismPath(repoPath, 'scheduler.json')); } catch { /* ok */ }
}

export async function getSchedulerStatus(repoPath: string): Promise<SchedulerConfig | null> {
  return readJsonFile<SchedulerConfig>(getOrganismPath(repoPath, 'scheduler.json'));
}
