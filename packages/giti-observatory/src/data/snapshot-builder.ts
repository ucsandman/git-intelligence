import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ObservatorySnapshot,
  CycleDigest,
  OrganismEventDigest,
  DispatchDigest,
  CyclePhase,
} from '../types/snapshot.js';

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonDir<T>(dirPath: string): Promise<T[]> {
  try {
    const files = await readdir(dirPath);
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();
    const results: T[] = [];
    for (const file of jsonFiles) {
      const data = await readJson<T>(join(dirPath, file));
      if (data) results.push(data);
    }
    return results;
  } catch {
    return [];
  }
}

interface OrganismConfig {
  identity: { name: string; purpose: string };
  boundaries: { growth_zone: string[]; forbidden_zone: string[] };
  quality_standards: {
    test_coverage_floor: number;
    max_complexity_per_function: number;
    max_file_length: number;
  };
  lifecycle: {
    cycle_frequency: string;
    max_changes_per_cycle: number;
    mandatory_cooldown_after_regression: string;
    branch_naming: string;
    requires_immune_approval: boolean;
  };
}

interface KnowledgeBase {
  created: string;
  last_updated: string;
  cycle_count: number;
  events: Array<{
    id: string;
    timestamp: string;
    cycle: number;
    type: string;
    agent: string;
    summary: string;
    data: Record<string, unknown>;
    tags: string[];
  }>;
  lessons: Array<{ text: string; confidence: number }>;
  patterns: {
    fragile_files: Array<{ file: string; regression_count: number }>;
    rejection_reasons: Record<string, number>;
    successful_change_types: Record<string, number>;
    failed_change_types: Record<string, number>;
  };
  preferences: Array<{ key: string; value: string }>;
}

interface ActiveCycle {
  cycle: number;
  phase: string;
  started: string;
}

interface CooldownData {
  until: string;
}

interface CycleCounter {
  count: number;
}

interface StateReport {
  timestamp: string;
  quality?: {
    test_coverage_percent?: number;
    lint_error_count?: number;
  };
  performance?: Record<string, number>;
  dependencies?: {
    total_count?: number;
    outdated_count?: number;
    vulnerable_count?: number;
  };
  git?: {
    commits_last_7d?: number;
  };
}

function detectCurrentState(
  _organismDir: string,
  hasKillSwitch: boolean,
  activeCycle: ActiveCycle | null,
  cooldown: CooldownData | null,
): 'active' | 'idle' | 'cooldown' | 'killed' {
  if (hasKillSwitch) return 'killed';
  if (activeCycle) return 'active';
  if (cooldown && new Date(cooldown.until) > new Date()) return 'cooldown';
  return 'idle';
}

function computeVitals(
  stateReports: StateReport[],
  kb: KnowledgeBase | null,
  cycleCount: number,
): ObservatorySnapshot['vitals'] {
  const latest = stateReports[stateReports.length - 1];
  const coverage = latest?.quality?.test_coverage_percent ?? 0;
  const complexity = 0; // derived from quality if available
  const depHealth = latest?.dependencies
    ? Math.max(
        0,
        1 -
          ((latest.dependencies.outdated_count ?? 0) +
            (latest.dependencies.vulnerable_count ?? 0)) /
            Math.max(latest.dependencies.total_count ?? 1, 1),
      )
    : 1;
  const velocity = latest?.git?.commits_last_7d ?? 0;

  const totalMerged =
    kb?.events.filter((e) => e.type === 'change-merged').length ?? 0;
  const totalAttempted =
    totalMerged +
    (kb?.events.filter((e) => e.type === 'change-rejected').length ?? 0);
  const mutationSuccess =
    totalAttempted > 0 ? totalMerged / totalAttempted : 0;

  const regressions =
    kb?.events.filter((e) => e.type === 'regression-detected').length ?? 0;
  const regressionRate = cycleCount > 0 ? regressions / cycleCount : 0;

  const fitness = Math.round(
    coverage * 0.3 +
      (1 - Math.min(complexity / 15, 1)) * 100 * 0.2 +
      depHealth * 100 * 0.15 +
      Math.min(velocity / 10, 1) * 100 * 0.15 +
      mutationSuccess * 100 * 0.1 +
      (1 - regressionRate) * 100 * 0.1,
  );

  return {
    fitness_score: Math.min(100, Math.max(0, fitness)),
    test_coverage: coverage,
    complexity_avg: complexity,
    dependency_health: Math.round(depHealth * 100),
    commit_velocity_7d: velocity,
    mutation_success_rate: Math.round(mutationSuccess * 100),
    regression_rate: Math.round(regressionRate * 100),
  };
}

export async function buildSnapshot(
  repoPath: string,
): Promise<ObservatorySnapshot> {
  const organismDir = join(repoPath, '.organism');

  // Read core files in parallel
  const [config, cycleCounter, kb, activeCycle, cooldown, hasKillSwitch] =
    await Promise.all([
      readJson<OrganismConfig>(join(repoPath, 'organism.json')),
      readJson<CycleCounter>(join(organismDir, 'cycle-counter.json')),
      readJson<KnowledgeBase>(join(organismDir, 'knowledge-base.json')),
      readJson<ActiveCycle>(join(organismDir, 'active-cycle.json')),
      readJson<CooldownData>(join(organismDir, 'cooldown-until.json')),
      fileExists(join(organismDir, 'kill-switch')),
    ]);

  const cycleCount = cycleCounter?.count ?? 0;
  const state = detectCurrentState(
    organismDir,
    hasKillSwitch,
    activeCycle,
    cooldown,
  );

  // Read historical data
  const stateReports = await readJsonDir<StateReport>(
    join(organismDir, 'state-reports'),
  );
  const dispatches = await readJsonDir<DispatchDigest>(
    join(organismDir, 'content', 'dispatches'),
  );

  // Compute vitals from latest state report
  const vitals = computeVitals(stateReports, kb, cycleCount);

  // Extract events for recent_events (last 50)
  const allEvents = kb?.events ?? [];
  const recentEvents: OrganismEventDigest[] = allEvents
    .slice(-50)
    .reverse()
    .map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      cycle: e.cycle,
      type: e.type,
      agent: e.agent,
      summary: e.summary,
    }));

  // Detect milestones from dispatches
  const milestones = dispatches
    .filter((d) => d.milestone)
    .map((d) => d.milestone as string);

  // Build cycle history from events
  const cycleNumbers = [...new Set(allEvents.map((e) => e.cycle))].sort(
    (a, b) => a - b,
  );
  const history: CycleDigest[] = cycleNumbers.map((cycle) => {
    const cycleEvents = allEvents.filter((e) => e.cycle === cycle);
    const merged = cycleEvents.filter(
      (e) => e.type === 'change-merged',
    ).length;
    const rejected = cycleEvents.filter(
      (e) => e.type === 'change-rejected',
    ).length;
    const growth = cycleEvents.filter(
      (e) => e.type === 'growth-proposed',
    ).length;
    const hasRegression = cycleEvents.some(
      (e) => e.type === 'regression-detected',
    );
    const dispatch = dispatches.find((d) => d.cycle === cycle);

    let outcome: CycleDigest['outcome'] = 'stable';
    if (hasRegression) outcome = 'regression';
    else if (merged > 0) outcome = 'productive';
    else if (rejected > 0) outcome = 'no-changes';

    return {
      cycle,
      timestamp: cycleEvents[0]?.timestamp ?? '',
      outcome,
      changes_merged: merged,
      changes_rejected: rejected,
      growth_proposals: growth,
      api_tokens_used: 0,
      duration_ms: 0,
      milestone: dispatch?.milestone,
    };
  });

  // Compute organism born date
  const born = kb?.created ?? allEvents[0]?.timestamp ?? '';

  // Total merged from all history
  const totalMerged = history.reduce((sum, c) => sum + c.changes_merged, 0);

  return {
    organism: {
      name: config?.identity.name ?? 'unknown',
      version: '0.1.0',
      born,
      total_cycles: cycleCount,
      total_changes_merged: totalMerged,
      current_state: state,
    },
    vitals,
    current_cycle: activeCycle
      ? {
          number: activeCycle.cycle,
          phase: activeCycle.phase as CyclePhase,
          started: activeCycle.started,
          events: recentEvents.filter((e) => e.cycle === activeCycle.cycle),
        }
      : undefined,
    history,
    dispatches,
    milestones,
    recent_events: recentEvents,
    knowledge: {
      total_lessons: kb?.lessons.length ?? 0,
      fragile_files: kb?.patterns.fragile_files.map((f) => f.file) ?? [],
      rejection_reasons: kb?.patterns.rejection_reasons ?? {},
      successful_change_types: kb?.patterns.successful_change_types ?? {},
      failed_change_types: kb?.patterns.failed_change_types ?? {},
      preferences: kb?.preferences.map((p) => p.value) ?? [],
    },
  };
}
