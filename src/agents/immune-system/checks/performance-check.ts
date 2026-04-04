import type { CheckResult } from '../types.js';
import type { Baselines } from '../types.js';
import type { OrganismConfig } from '../../types.js';
import { runCommand } from '../../utils.js';

interface CommandSpec {
  label: string;
  args: string[];
  budgetKey: string;
  baselineKey: keyof Baselines['performance'];
}

const COMMANDS: CommandSpec[] = [
  {
    label: 'pulse',
    args: ['dist/index.js', 'pulse', '--json'],
    budgetKey: 'pulse_command',
    baselineKey: 'pulse_ms',
  },
  {
    label: 'hotspots',
    args: ['dist/index.js', 'hotspots', '--json'],
    budgetKey: 'hotspots_command',
    baselineKey: 'hotspots_ms',
  },
  {
    label: 'ghosts',
    args: ['dist/index.js', 'ghosts', '--json'],
    budgetKey: 'ghosts_command',
    baselineKey: 'ghosts_ms',
  },
];

function parseBudgetMs(budget: string): number {
  const match = budget.match(/(\d+)\s*seconds?/);
  return match ? parseInt(match[1]!, 10) * 1000 : 10000;
}

export async function runPerformanceCheck(
  repoPath: string,
  config: OrganismConfig,
  baselines: Baselines | null,
): Promise<CheckResult> {
  const name = 'Performance';
  const budgets = config.quality_standards.performance_budget;

  const timings: Record<string, number> = {};
  const budgetFailures: string[] = [];
  const degradations: string[] = [];

  for (const cmd of COMMANDS) {
    const budgetStr = budgets[cmd.budgetKey] ?? budgets['any_new_command'] ?? '';
    const budgetMs = parseBudgetMs(budgetStr);

    const start = Date.now();
    runCommand('node', cmd.args, repoPath);
    const elapsed = Date.now() - start;

    timings[cmd.label] = elapsed;

    // Check against budget
    if (elapsed > budgetMs) {
      budgetFailures.push(`${cmd.label}: ${elapsed}ms (budget: ${budgetMs}ms)`);
    }

    // Check for degradation from baseline (>10%)
    if (baselines) {
      const baselineMs = baselines.performance[cmd.baselineKey];
      const threshold = baselineMs * 1.1;
      if (elapsed > threshold) {
        degradations.push(
          `${cmd.label} degraded from ${baselineMs}ms to ${elapsed}ms`,
        );
      }
    }
  }

  // Fail if any command exceeds its budget
  if (budgetFailures.length > 0) {
    return {
      name,
      status: 'fail',
      message: budgetFailures.join(', '),
    };
  }

  // Warn if any command degraded >10% from baseline
  if (degradations.length > 0) {
    return {
      name,
      status: 'warn',
      message: degradations.join(', '),
    };
  }

  // All good
  const parts = COMMANDS.map((cmd) => `${cmd.label}: ${timings[cmd.label]}ms`);
  return {
    name,
    status: 'pass',
    message: parts.join(', '),
  };
}
