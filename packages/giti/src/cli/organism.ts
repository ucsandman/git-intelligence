import { startScheduler, stopScheduler } from '../agents/orchestrator/index.js';
import { getOrganismStatus } from '../agents/orchestrator/index.js';
import chalk from 'chalk';

export async function executeOrganism(subcommand: string, options: { path?: string; json?: boolean; interval?: string }): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  switch (subcommand) {
    case 'start': {
      if (!process.env['ANTHROPIC_API_KEY']) {
        console.error('ANTHROPIC_API_KEY environment variable is required');
        process.exit(1);
      }
      const intervalMs = options.interval ? parseInterval(options.interval) : 24 * 60 * 60 * 1000;
      console.log(`Starting organism with ${formatInterval(intervalMs)} cycle interval...`);
      await startScheduler(repoPath, intervalMs);
      break;
    }
    case 'stop': {
      await stopScheduler(repoPath);
      console.log('Organism stopped. Kill switch activated.');
      break;
    }
    case 'status': {
      const status = await getOrganismStatus(repoPath);
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        const stateColor = status.state === 'running' ? chalk.green :
                          status.state === 'cooldown' ? chalk.yellow : chalk.red;
        console.log(chalk.bold('\n🧬 Organism Status'));
        console.log(chalk.dim('──────────────────'));
        console.log(`State:          ${stateColor(status.state)}`);
        console.log(`Total cycles:   ${status.total_cycles}`);
        console.log(`Changes merged: ${status.total_changes_merged}`);
        console.log(`Changes rejected: ${status.total_changes_rejected}`);
        console.log(`API tokens:     ${status.total_api_tokens} / ${status.api_budget}`);
        console.log(`Failures:       ${status.consecutive_failures}`);
        if (status.cooldown_until) {
          console.log(`Cooldown until: ${status.cooldown_until}`);
        }
        if (status.last_cycle) {
          console.log(`\nLast cycle:     #${status.last_cycle.cycle} — ${status.last_cycle.outcome}`);
        }
      }
      break;
    }
    default: {
      console.error(`Unknown subcommand: ${subcommand}. Use: start, stop, status`);
      process.exit(1);
    }
  }
}

function parseInterval(value: string): number {
  const match = value.match(/^(\d+)(h|m|s)$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h
  const num = parseInt(match[1]!, 10);
  switch (match[2]) {
    case 'h': return num * 60 * 60 * 1000;
    case 'm': return num * 60 * 1000;
    case 's': return num * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

function formatInterval(ms: number): string {
  if (ms >= 60 * 60 * 1000) return `${ms / (60 * 60 * 1000)}h`;
  if (ms >= 60 * 1000) return `${ms / (60 * 1000)}m`;
  return `${ms / 1000}s`;
}
