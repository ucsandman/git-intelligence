import { Command } from 'commander';
import { executePulse } from './commands/pulse.js';
import { executeHotspots } from './commands/hotspots.js';
import { executeGhosts } from './commands/ghosts.js';
import { executeSense } from './cli/sense.js';
import { executeReview } from './cli/review.js';
import { executeRemember } from './cli/remember.js';

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

program.parse();
