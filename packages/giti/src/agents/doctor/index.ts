import fs from 'node:fs/promises';
import path from 'node:path';
import { getOrganismStatus } from '../orchestrator/index.js';
import type { OrganismStatus } from '../orchestrator/types.js';
import { loadLatestCyclePlan } from '../prefrontal-cortex/backlog.js';
import type { CyclePlan, WorkItem } from '../prefrontal-cortex/types.js';
import { getOrganismPath, readJsonFile } from '../utils.js';
import { isValidStateReport } from '../sensory-cortex/state-report-schema.js';
import type { StateReport } from '../sensory-cortex/types.js';
import { pathContainsIgnoredSourceDirectory } from '../sensory-cortex/source-scope.js';

export type DoctorHealthStatus = 'bootstrap' | 'healthy' | 'attention' | 'blocked';
export type DoctorSignalLevel = 'info' | 'warning' | 'critical';
export type DoctorSafetyGateStatus = 'pass' | 'warn' | 'block';

export interface DoctorHealth {
  status: DoctorHealthStatus;
  current_state: OrganismStatus['state'];
  summary: string;
  last_report_at: string | null;
}

export interface DoctorSignal {
  level: DoctorSignalLevel;
  label: string;
  value: string;
  detail: string;
}

export interface DoctorAction {
  title: string;
  command: string;
  rationale: string;
  risk: 'read_only' | 'low' | 'medium' | 'high';
}

export interface DoctorSafetyGate {
  name: string;
  status: DoctorSafetyGateStatus;
  detail: string;
}

export interface DoctorSafety {
  read_only: true;
  gates: DoctorSafetyGate[];
}

export interface DoctorDiagnosis {
  health: DoctorHealth;
  signals: DoctorSignal[];
  next_action: DoctorAction;
  safety: DoctorSafety;
  recommendations: DoctorAction[];
}

interface ActiveCycleLock {
  started?: string;
  cycle?: number;
}

interface BuildDoctorOptions {
  report?: StateReport | null;
  plan?: CyclePlan | null;
  status?: OrganismStatus;
  activeCycle?: ActiveCycleLock | null;
  killSwitchActive?: boolean;
}

export async function buildDoctorDiagnosis(
  repoPath: string,
  options: BuildDoctorOptions = {},
): Promise<DoctorDiagnosis> {
  const [loadedReport, loadedPlan, loadedStatus, activeCycle, killSwitchActive] = await Promise.all([
    'report' in options ? Promise.resolve(options.report ?? null) : loadLatestStateReport(repoPath),
    'plan' in options ? Promise.resolve(options.plan ?? null) : loadLatestCyclePlan(repoPath),
    options.status ? Promise.resolve(options.status) : getOrganismStatus(repoPath),
    'activeCycle' in options ? Promise.resolve(options.activeCycle ?? null) : readJsonFile<ActiveCycleLock>(getOrganismPath(repoPath, 'active-cycle.json')),
    'killSwitchActive' in options ? Promise.resolve(options.killSwitchActive ?? false) : pathExists(getOrganismPath(repoPath, 'kill-switch')),
  ]);

  const signals = buildSignals(loadedReport);
  const safety = buildSafety(loadedStatus, activeCycle, killSwitchActive);
  const recommendations = buildRecommendations(loadedReport, loadedPlan, loadedStatus, safety);
  const health = buildHealth(loadedReport, loadedStatus, signals, safety);

  return {
    health,
    signals,
    next_action: recommendations[0] ?? bootstrapRecommendation(),
    safety,
    recommendations,
  };
}

async function loadLatestStateReport(repoPath: string): Promise<StateReport | null> {
  const reportsDir = getOrganismPath(repoPath, 'state-reports');
  let entries: string[];
  try {
    entries = await fs.readdir(reportsDir);
  } catch {
    return null;
  }

  const reports: StateReport[] = [];
  for (const entry of entries.filter((name) => name.endsWith('.json'))) {
    const report = await readJsonFile<unknown>(path.join(reportsDir, entry));
    if (isValidStateReport(report)) {
      reports.push(report);
    }
  }

  reports.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return reports[reports.length - 1] ?? null;
}

function buildHealth(
  report: StateReport | null,
  status: OrganismStatus,
  signals: DoctorSignal[],
  safety: DoctorSafety,
): DoctorHealth {
  if (!report) {
    return {
      status: 'bootstrap',
      current_state: status.state,
      summary: 'No organism state reports found. Run the first sensory scan to establish a baseline.',
      last_report_at: null,
    };
  }

  if (safety.gates.some((gate) => gate.status === 'block')) {
    return {
      status: 'blocked',
      current_state: status.state,
      summary: 'A safety gate is blocking autonomous work.',
      last_report_at: report.timestamp,
    };
  }

  if (signals.some((signal) => signal.level !== 'info')) {
    return {
      status: 'attention',
      current_state: status.state,
      summary: 'The organism has actionable quality or state signals.',
      last_report_at: report.timestamp,
    };
  }

  return {
    status: 'healthy',
    current_state: status.state,
    summary: 'The latest organism state looks healthy.',
    last_report_at: report.timestamp,
  };
}

function buildSignals(report: StateReport | null): DoctorSignal[] {
  if (!report) {
    return [
      {
        level: 'info',
        label: 'state report',
        value: 'missing',
        detail: 'No `.organism/state-reports` JSON was found.',
      },
      {
        level: 'info',
        label: 'baseline',
        value: 'not established',
        detail: 'Run `giti sense` to collect quality, dependency, performance, and codebase signals.',
      },
      {
        level: 'info',
        label: 'doctor mode',
        value: 'read-only',
        detail: 'This command only inspects existing state.',
      },
    ];
  }

  const signals: DoctorSignal[] = [];
  const pollutedPaths = findGeneratedOutputPollution(report);
  if (pollutedPaths.length > 0) {
    signals.push({
      level: 'warning',
      label: 'generated output pollution',
      value: `${pollutedPaths.length} generated path(s) in report`,
      detail: pollutedPaths.slice(0, 3).join(', '),
    });
  }

  signals.push({
    level: report.quality.test_pass_rate < 1 ? 'warning' : 'info',
    label: 'test pass rate',
    value: `${Math.round(report.quality.test_pass_rate * 100)}%`,
    detail: `${report.quality.test_file_count} test files tracked`,
  });

  signals.push({
    level: report.quality.lint_error_count > 0 ? 'critical' : 'info',
    label: 'lint errors',
    value: String(report.quality.lint_error_count),
    detail: report.quality.lint_error_count > 0 ? 'TypeScript lint/typecheck errors need repair.' : 'No lint errors in latest report.',
  });

  signals.push({
    level: report.dependencies.vulnerable_count > 0 ? 'critical' : report.dependencies.outdated_count > 0 ? 'warning' : 'info',
    label: 'dependencies',
    value: `${report.dependencies.outdated_count} outdated, ${report.dependencies.vulnerable_count} vulnerable`,
    detail: `${report.dependencies.total_count} dependencies observed`,
  });

  return signals.slice(0, 3);
}

function findGeneratedOutputPollution(report: StateReport): string[] {
  const candidates = [
    ...report.quality.files_exceeding_length_limit,
    ...report.quality.functions_exceeding_complexity.map((entry) => entry.split(':')[0] ?? entry),
    ...report.codebase.largest_files.map((entry) => entry.path),
  ];

  return Array.from(new Set(candidates.filter((entry) => pathContainsIgnoredSourceDirectory(entry))));
}

function buildSafety(
  status: OrganismStatus,
  activeCycle: ActiveCycleLock | null,
  killSwitchActive: boolean,
): DoctorSafety {
  const gates: DoctorSafetyGate[] = [
    {
      name: 'kill switch',
      status: killSwitchActive ? 'block' : 'pass',
      detail: killSwitchActive ? 'Kill switch file is present.' : 'No kill switch file present.',
    },
    {
      name: 'cooldown',
      status: status.cooldown_until ? 'block' : 'pass',
      detail: status.cooldown_until ? `Cooldown until ${status.cooldown_until}.` : 'No active cooldown.',
    },
    {
      name: 'cycle lock',
      status: activeCycle ? 'warn' : 'pass',
      detail: activeCycle ? `Cycle ${activeCycle.cycle ?? 'unknown'} started at ${activeCycle.started ?? 'unknown time'}.` : 'No active cycle lock.',
    },
    {
      name: 'consecutive failures',
      status: status.consecutive_failures >= 3 ? 'block' : status.consecutive_failures > 0 ? 'warn' : 'pass',
      detail: `${status.consecutive_failures} consecutive failure(s).`,
    },
    {
      name: 'api budget',
      status: status.total_api_tokens >= status.api_budget ? 'block' : 'pass',
      detail: `${status.total_api_tokens} / ${status.api_budget} tokens recorded.`,
    },
  ];

  return { read_only: true, gates };
}

function buildRecommendations(
  report: StateReport | null,
  plan: CyclePlan | null,
  status: OrganismStatus,
  safety: DoctorSafety,
): DoctorAction[] {
  if (!report) {
    return [bootstrapRecommendation()];
  }

  if (safety.gates.some((gate) => gate.status === 'block')) {
    return [
      {
        title: 'Inspect safety status',
        command: 'giti organism status',
        rationale: `Current organism state is ${status.state}; clear safety gates before autonomous work.`,
        risk: 'read_only',
      },
    ];
  }

  const recommendations: DoctorAction[] = [];
  const firstItem = plan?.selected_items[0];
  if (firstItem) {
    recommendations.push(actionFromWorkItem(firstItem));
  }

  const firstAction = plan?.action_recommendations?.[0];
  if (firstAction) {
    recommendations.push({
      title: `Review ${firstAction.template_id}`,
      command: 'giti cycle --supervised',
      rationale: firstAction.rationale[0] ?? `Eligible ${firstAction.risk} declarative action.`,
      risk: firstAction.risk,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: 'Generate a fresh cycle plan',
      command: 'giti plan --dry-run',
      rationale: 'No saved planned work was found for the latest report.',
      risk: 'read_only',
    });
  }

  return recommendations;
}

function actionFromWorkItem(item: WorkItem): DoctorAction {
  return {
    title: item.title,
    command: `giti build ${item.id}`,
    rationale: item.rationale,
    risk: item.estimated_complexity === 'large' ? 'medium' : 'low',
  };
}

function bootstrapRecommendation(): DoctorAction {
  return {
    title: 'Run sensory scan',
    command: 'giti sense',
    rationale: 'No organism state exists yet, so the first step is to collect a read of the repo.',
    risk: 'read_only',
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
