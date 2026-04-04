import { Command } from 'commander';
import { executePulse } from './commands/pulse.js';
import { executeHotspots } from './commands/hotspots.js';
import { executeGhosts } from './commands/ghosts.js';

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

program.parse();
