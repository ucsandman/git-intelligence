import fs from 'node:fs/promises';
import path from 'node:path';
import { readJsonFile, getOrganismPath } from '../utils.js';

export type HeartbeatStatus = 'healthy' | 'degraded' | 'critical';

export interface HeartbeatCheck {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  status: HeartbeatStatus;
  message: string;
}

export interface HeartbeatReport {
  timestamp: string;
  overall: HeartbeatStatus;
  checks: HeartbeatCheck[];
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FIFTY_MB = 50 * 1024 * 1024;
const HUNDRED_MB = 100 * 1024 * 1024;

async function checkCycleLock(repoPath: string): Promise<HeartbeatCheck> {
  const data = await readJsonFile<{ started: string; cycle: number }>(
    getOrganismPath(repoPath, 'active-cycle.json'),
  );

  if (!data) {
    return { name: 'cycle-lock', severity: 'critical', status: 'healthy', message: 'No active cycle lock' };
  }

  const age = Date.now() - new Date(data.started).getTime();
  if (age > TWO_HOURS_MS) {
    return { name: 'cycle-lock', severity: 'critical', status: 'critical', message: `Cycle ${data.cycle} locked for ${Math.round(age / ONE_HOUR_MS)}h — likely stale` };
  }
  if (age > ONE_HOUR_MS) {
    return { name: 'cycle-lock', severity: 'critical', status: 'degraded', message: `Cycle ${data.cycle} running for ${Math.round(age / 60000)}min` };
  }
  return { name: 'cycle-lock', severity: 'critical', status: 'healthy', message: `Cycle ${data.cycle} running normally` };
}

async function checkConsecutiveFailures(repoPath: string): Promise<HeartbeatCheck> {
  const data = await readJsonFile<{ count: number }>(
    getOrganismPath(repoPath, 'consecutive-failures.json'),
  );
  const count = data?.count ?? 0;

  if (count >= 3) {
    return { name: 'consecutive-failures', severity: 'critical', status: 'critical', message: `${count} consecutive failures — organism paused` };
  }
  if (count >= 2) {
    return { name: 'consecutive-failures', severity: 'critical', status: 'degraded', message: `${count} consecutive failures — approaching pause threshold` };
  }
  return { name: 'consecutive-failures', severity: 'critical', status: 'healthy', message: count === 0 ? 'No consecutive failures' : '1 failure — within tolerance' };
}

async function checkApiBudget(repoPath: string): Promise<HeartbeatCheck> {
  const data = await readJsonFile<{ total_tokens: number; monthly_tokens: number; month: string; budget: number }>(
    getOrganismPath(repoPath, 'api-usage.json'),
  );

  if (!data) {
    return { name: 'api-budget', severity: 'warning', status: 'healthy', message: 'No API usage recorded' };
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyTokens = data.month === currentMonth ? data.monthly_tokens : 0;
  const ratio = monthlyTokens / data.budget;

  if (ratio >= 1) {
    return { name: 'api-budget', severity: 'warning', status: 'critical', message: `API budget exhausted (${monthlyTokens}/${data.budget} tokens)` };
  }
  if (ratio >= 0.8) {
    return { name: 'api-budget', severity: 'warning', status: 'degraded', message: `API budget at ${Math.round(ratio * 100)}% (${monthlyTokens}/${data.budget} tokens)` };
  }
  return { name: 'api-budget', severity: 'warning', status: 'healthy', message: `API budget at ${Math.round(ratio * 100)}% (${monthlyTokens}/${data.budget} tokens)` };
}

async function checkCooldown(repoPath: string): Promise<HeartbeatCheck> {
  const data = await readJsonFile<{ until: string }>(
    getOrganismPath(repoPath, 'cooldown-until.json'),
  );

  if (!data?.until) {
    return { name: 'cooldown', severity: 'warning', status: 'healthy', message: 'No cooldown active' };
  }

  const untilTime = new Date(data.until).getTime();
  if (untilTime > Date.now()) {
    const remainingMin = Math.round((untilTime - Date.now()) / 60000);
    return { name: 'cooldown', severity: 'warning', status: 'degraded', message: `Cooldown active — ${remainingMin}min remaining` };
  }
  return { name: 'cooldown', severity: 'warning', status: 'healthy', message: 'Cooldown expired' };
}

async function getDirSizeRecursive(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirSizeRecursive(fullPath);
    } else {
      const stat = await fs.stat(fullPath);
      total += stat.size;
    }
  }
  return total;
}

async function checkOrganismDirSize(repoPath: string): Promise<HeartbeatCheck> {
  const orgDir = getOrganismPath(repoPath);
  let totalSize: number;

  try {
    totalSize = await getDirSizeRecursive(orgDir);
  } catch {
    return { name: 'organism-dir-size', severity: 'info', status: 'healthy', message: 'No .organism directory' };
  }

  const sizeMb = Math.round(totalSize / (1024 * 1024) * 10) / 10;

  if (totalSize > HUNDRED_MB) {
    return { name: 'organism-dir-size', severity: 'info', status: 'critical', message: `.organism/ is ${sizeMb}MB — exceeds 100MB limit` };
  }
  if (totalSize > FIFTY_MB) {
    return { name: 'organism-dir-size', severity: 'info', status: 'degraded', message: `.organism/ is ${sizeMb}MB — approaching 100MB limit` };
  }
  return { name: 'organism-dir-size', severity: 'info', status: 'healthy', message: `.organism/ is ${sizeMb}MB` };
}

export async function runHeartbeat(repoPath: string): Promise<HeartbeatReport> {
  const checks = await Promise.all([
    checkCycleLock(repoPath),
    checkConsecutiveFailures(repoPath),
    checkApiBudget(repoPath),
    checkCooldown(repoPath),
    checkOrganismDirSize(repoPath),
  ]);

  let overall: HeartbeatStatus = 'healthy';
  for (const check of checks) {
    if (check.status === 'critical') { overall = 'critical'; break; }
    if (check.status === 'degraded') overall = 'degraded';
  }

  return { timestamp: new Date().toISOString(), overall, checks };
}
