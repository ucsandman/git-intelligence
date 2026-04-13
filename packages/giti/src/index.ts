import { loadEnv } from './env-loader.js';

// Load .env by walking up from CWD so `giti` works from any subdirectory.
loadEnv();

import { Command } from 'commander';
import { executePulse } from './commands/pulse.js';
import { executeHotspots } from './commands/hotspots.js';
import { executeGhosts } from './commands/ghosts.js';
import { executeSense } from './cli/sense.js';
import { executeReview } from './cli/review.js';
import { executeRemember } from './cli/remember.js';
import { executePlan } from './cli/plan.js';
import { executeBuild } from './cli/build.js';
import { executeCycle } from './cli/cycle.js';
import { executeOrganism } from './cli/organism.js';
import { executeTelemetry } from './cli/telemetry-cmd.js';
import { executeSimulate } from './cli/simulate.js';
import { executeGrow } from './cli/grow.js';
import { executeDispatch } from './cli/dispatch.js';
import { executeObserve } from './cli/observe.js';

process.on('unhandledRejection', (reason, _promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const program = new Command();

program
  .name('giti')
  .description('Git Intelligence — transform raw git data into actionable insights')
  .version('0.1.0');

program
  .command('pulse')
  .description('Quick health snapshot of the repository')
  .option('--json', 'Output raw JSON instead of formatted terminal output')
  .option('--path <dir>', 'Analyze a repo at a different path')
  .action(async (options: { json?: boolean; path?: string }) => {
    await executePulse(options);
  });

program
  .command('hotspots')
  .description('Identify the most volatile parts of the codebase')
  .option('--since <period>', 'Time window (e.g., 7d, 30d, 90d, 1y)', '30d')
  .option('--top <n>', 'Number of hotspots to show', '10')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .action(async (options: { since?: string; top?: string; json?: boolean; path?: string }) => {
    await executeHotspots({
      ...options,
      top: options.top ? parseInt(options.top, 10) : undefined,
    });
  });

program
  .command('ghosts')
  .description('Find abandoned and forgotten work')
  .option('--stale-days <n>', 'Threshold for stale branches in days', '30')
  .option('--dead-months <n>', 'Threshold for dead code in months', '6')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .action(async (options: { staleDays?: string; deadMonths?: string; json?: boolean; path?: string }) => {
    await executeGhosts({
      ...options,
      staleDays: options.staleDays ? parseInt(options.staleDays, 10) : undefined,
      deadMonths: options.deadMonths ? parseInt(options.deadMonths, 10) : undefined,
    });
  });

program
  .command('sense')
  .description('Run sensory cortex — comprehensive organism state scan')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .action(async (options: { json?: boolean; path?: string }) => {
    await executeSense(options);
  });

program
  .command('review <branch>')
  .description('Run immune system review on a branch')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .action(async (branch: string, options: { json?: boolean; path?: string }) => {
    await executeReview(branch, options);
  });

program
  .command('remember <subcommand> [args...]')
  .description('Interact with organism memory (record, query, summary)')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .option('--type <type>', 'Event type for record subcommand')
  .option('--data <json>', 'Event data as JSON string')
  .option('--category <cat>', 'Category filter for summary')
  .action(
    async (
      subcommand: string,
      args: string[],
      options: { json?: boolean; path?: string; type?: string; data?: string; category?: string },
    ) => {
      await executeRemember(subcommand, args, options);
    },
  );

program
  .command('plan')
  .description('Generate a prioritized cycle plan based on current state')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .option('--dry-run', 'Show plan without saving')
  .action(async (options: { json?: boolean; path?: string; dryRun?: boolean }) => {
    await executePlan(options);
  });

program
  .command('build [item-id]')
  .description('Implement a work item from the cycle plan')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .option('--all', 'Build all items in the current plan')
  .action(async (itemId: string | undefined, options: { json?: boolean; path?: string; all?: boolean }) => {
    await executeBuild(itemId, options);
  });

program
  .command('cycle')
  .description('Run a complete lifecycle cycle')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .option('--supervised', 'Require human approval before merging')
  .action(async (options: { json?: boolean; path?: string; supervised?: boolean }) => {
    await executeCycle(options);
  });

program
  .command('organism <subcommand>')
  .description('Manage the organism (start, stop, status)')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .option('--interval <duration>', 'Cycle interval (e.g., 24h, 12h, 1h)', '24h')
  .action(async (subcommand: string, options: { json?: boolean; path?: string; interval?: string }) => {
    await executeOrganism(subcommand, options);
  });

program
  .command('telemetry <subcommand>')
  .description('Manage telemetry settings (on, off, status, show, clear)')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .option('--last <n>', 'Number of recent events to show')
  .action(async (subcommand: string, options: { json?: boolean; path?: string; last?: string }) => {
    await executeTelemetry(subcommand, options);
  });

program
  .command('simulate')
  .description('Generate synthetic telemetry from diverse repos')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Target repo for telemetry output')
  .option('--scenarios <n>', 'Number of scenarios to run', '20')
  .action(async (options: { json?: boolean; path?: string; scenarios?: string }) => {
    await executeSimulate(options);
  });

program
  .command('grow')
  .description('Run Growth Hormone — analyze telemetry and propose features')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .option('--show [proposal-id]', 'Show existing proposals')
  .action(async (options: { json?: boolean; path?: string; show?: boolean | string }) => {
    await executeGrow(options);
  });

program
  .command('dispatch')
  .description('View evolution dispatches (content pipeline)')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'Analyze a different repo')
  .option('--cycle <n>', 'Show dispatch for a specific cycle')
  .option('--list', 'List all dispatches')
  .option('--platform <name>', 'Format for platform (twitter, linkedin, hn, blog)')
  .action(async (options: { json?: boolean; path?: string; cycle?: string; list?: boolean; platform?: string }) => {
    await executeDispatch(options);
  });

program
  .command('observe')
  .description('Run field observation against configured external targets')
  .option('--json', 'Output raw JSON')
  .option('--path <dir>', 'giti repo path (default: current directory)')
  .action(async (options: { json?: boolean; path?: string }) => {
    await executeObserve(options);
  });

program
  .command('observatory [subcommand]')
  .description('Live terrarium visualization (start server, push snapshot, check status)')
  .option('--path <path>', 'Repository path', '.')
  .option('--port <port>', 'Server port', '3333')
  .option('--json', 'Output as JSON', false)
  .action(async (subcommand: string | undefined, options: { path: string; port?: string; json?: boolean }) => {
    const { executeObservatory } = await import('./cli/observatory.js');
    await executeObservatory(subcommand, options);
  });

program.parse();
