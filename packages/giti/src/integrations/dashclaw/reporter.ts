import fs from 'node:fs/promises';
import type {
  DashClawCycleReport,
  DashClawConfig,
  VitalSigns,
  CycleSummary,
  EvolutionaryState,
  DecisionEntry,
} from './types.js';
import type { StateReport } from '../../agents/sensory-cortex/types.js';
import type { CycleResult } from '../../agents/orchestrator/types.js';
import type { CyclePlan } from '../../agents/prefrontal-cortex/types.js';
import type { KnowledgeBase } from '../../agents/memory/types.js';
import {
  calculateFitnessScore,
  calculateDependencyHealth,
  calculateMutationSuccessRate,
  calculateRegressionRate,
} from './fitness.js';
import { ensureOrganismDir, getOrganismPath } from '../../agents/utils.js';

export interface ReportParams {
  cycleResult: CycleResult;
  stateReport: StateReport;
  plan: CyclePlan | null;
  history: CycleResult[];
  kb: KnowledgeBase | null;
  version: string;
}

export function buildDashClawReport(params: ReportParams): DashClawCycleReport {
  const { cycleResult, stateReport, plan, history, kb, version } = params;

  const vitalSigns: VitalSigns = {
    fitness_score: calculateFitnessScore(stateReport, history),
    test_coverage: stateReport.quality.test_coverage_percent,
    lint_errors: stateReport.quality.lint_error_count,
    complexity_avg: stateReport.codebase.avg_file_length,
    performance: {
      pulse: stateReport.performance.pulse_execution_ms,
      hotspots: stateReport.performance.hotspots_execution_ms,
      ghosts: stateReport.performance.ghosts_execution_ms,
    },
    dependency_health: calculateDependencyHealth(stateReport),
    commit_velocity_7d: stateReport.git.commits_last_7d,
    mutation_success_rate: calculateMutationSuccessRate(history),
    regression_rate: calculateRegressionRate(history),
  };

  const cycleSummary: CycleSummary = {
    outcome: cycleResult.outcome,
    items_planned: plan?.selected_items.length ?? 0,
    items_implemented: cycleResult.changes_attempted,
    items_approved: cycleResult.changes_approved,
    items_merged: cycleResult.changes_merged,
    growth_proposals: 0,
    api_tokens_used: cycleResult.api_tokens_used,
  };

  const decisions: DecisionEntry[] = [];
  if (kb) {
    const cycleEvents = kb.events.filter((e) => e.cycle === cycleResult.cycle);
    for (const event of cycleEvents) {
      decisions.push({
        agent: event.agent,
        action: event.type,
        reasoning: event.summary,
        outcome: (event.data['outcome'] as string) ?? event.type,
      });
    }
  }

  const evolutionaryState: EvolutionaryState = {
    total_commands: 14,
    commands_list: [
      'pulse',
      'hotspots',
      'ghosts',
      'sense',
      'review',
      'remember',
      'plan',
      'build',
      'cycle',
      'organism',
      'telemetry',
      'simulate',
      'grow',
      'dispatch',
    ],
    total_files: stateReport.codebase.total_files,
    total_lines: stateReport.codebase.total_lines,
    organism_born: kb?.created ?? new Date().toISOString(),
    total_cycles: history.length + 1,
    total_changes_merged:
      history.reduce((s, c) => s + c.changes_merged, 0) + cycleResult.changes_merged,
    total_changes_rejected:
      history.reduce((s, c) => s + c.changes_rejected, 0) + cycleResult.changes_rejected,
    growth_features_shipped: kb?.events.filter((e) => e.type === 'growth-approved').length ?? 0,
    current_cooldown: false,
    emerged_preferences: kb?.preferences.map((p) => p.preference) ?? [],
    top_lessons:
      kb?.lessons
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .map((l) => l.lesson) ?? [],
  };

  return {
    cycle_number: cycleResult.cycle,
    timestamp: new Date().toISOString(),
    organism_version: version,
    vital_signs: vitalSigns,
    cycle_summary: cycleSummary,
    decisions,
    evolutionary_state: evolutionaryState,
  };
}

export async function pushReport(
  report: DashClawCycleReport,
  repoPath: string,
  _config?: DashClawConfig,
): Promise<string> {
  if (_config?.api_key && _config?.endpoint) {
    // Future: POST to DashClaw API
    // For now, fall through to local
  }

  await ensureOrganismDir(repoPath, 'dashclaw-reports');
  const safeTs = report.timestamp.replace(/:/g, '-');
  const filename = `cycle-${report.cycle_number}-${safeTs}.json`;
  const filePath = getOrganismPath(repoPath, 'dashclaw-reports', filename);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return filePath;
}
