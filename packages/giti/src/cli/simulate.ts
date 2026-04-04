import { runSimulation } from '../simulator/index.js';
import chalk from 'chalk';
import ora from 'ora';

export async function executeSimulate(options: { path?: string; json?: boolean; scenarios?: string }): Promise<void> {
  const repoPath = options.path ?? process.cwd();
  const scenarioCount = options.scenarios ? parseInt(options.scenarios, 10) : 20;

  const spinner = options.json ? null : ora('Running usage simulation...').start();

  try {
    const result = await runSimulation(repoPath, { scenario_count: scenarioCount, repo_types: ['small', 'medium', 'large', 'fresh'] });
    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(chalk.bold('\nSimulation Complete'));
      console.log(chalk.dim('-'.repeat(25)));
      console.log(`Scenarios run:    ${result.total_scenarios}`);
      console.log(`Events generated: ${result.total_events}`);
      console.log(`Duration:         ${(result.duration_ms / 1000).toFixed(1)}s`);
      console.log(`\nTelemetry written to .organism/telemetry/events.jsonl`);
    }
  } catch (error) {
    spinner?.fail('Simulation failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
