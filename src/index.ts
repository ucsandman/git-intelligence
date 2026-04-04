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

program.parse();
