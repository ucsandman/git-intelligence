import type { StateReport } from '../../agents/sensory-cortex/types.js';
import type { CycleResult } from '../../agents/orchestrator/types.js';

export function calculateFitnessScore(report: StateReport, history: CycleResult[]): number {
  let score = 0;

  // Test coverage: 25 points max (0% -> 0, 100% -> 25)
  score += Math.min(25, (report.quality.test_coverage_percent / 100) * 25);

  // Lint health: 15 points max (0 errors -> 15, 10+ errors -> 0)
  score += Math.max(0, 15 - report.quality.lint_error_count * 1.5);

  // Performance: 15 points (each command over 5000ms loses 5 points)
  const perfValues = [
    report.performance.pulse_execution_ms,
    report.performance.hotspots_execution_ms,
    report.performance.ghosts_execution_ms,
  ];
  const overBudget = perfValues.filter((ms) => ms > 5000).length;
  score += Math.max(0, 15 - overBudget * 5);

  // Dependencies: 10 points (vulns lose 5 each, outdated lose 0.5 each)
  score += Math.max(0, 10 - report.dependencies.vulnerable_count * 5 - report.dependencies.outdated_count * 0.5);

  // Mutation success rate: 20 points (from history: approved/attempted)
  if (history.length > 0) {
    const totalAttempted = history.reduce((s, c) => s + c.changes_attempted, 0);
    const totalApproved = history.reduce((s, c) => s + c.changes_approved, 0);
    const rate = totalAttempted > 0 ? totalApproved / totalAttempted : 1;
    score += rate * 20;
  } else {
    score += 20;
  }

  // Regression rate: 15 points (0% regressions -> 15, 20%+ -> 0)
  if (history.length > 0) {
    const totalMerged = history.reduce((s, c) => s + c.changes_merged, 0);
    const totalRegs = history.filter((c) => c.regressions.length > 0).length;
    const regRate = totalMerged > 0 ? totalRegs / totalMerged : 0;
    score += Math.max(0, 15 * (1 - regRate * 5));
  } else {
    score += 15;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateDependencyHealth(report: StateReport): number {
  const vulnPenalty = report.dependencies.vulnerable_count * 20;
  const outdatedPenalty = report.dependencies.outdated_count * 5;
  return Math.max(0, 100 - vulnPenalty - outdatedPenalty);
}

export function calculateMutationSuccessRate(history: CycleResult[]): number {
  if (history.length === 0) return 1;
  const attempted = history.reduce((s, c) => s + c.changes_attempted, 0);
  const approved = history.reduce((s, c) => s + c.changes_approved, 0);
  return attempted > 0 ? approved / attempted : 1;
}

export function calculateRegressionRate(history: CycleResult[]): number {
  if (history.length === 0) return 0;
  const merged = history.reduce((s, c) => s + c.changes_merged, 0);
  const regs = history.filter((c) => c.regressions.length > 0).length;
  return merged > 0 ? regs / merged : 0;
}
