import { runLifecycleCycle } from '../agents/orchestrator/index.js';
import chalk from 'chalk';
import ora from 'ora';

export async function executeCycle(options: { path?: string; json?: boolean; supervised?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  if (!process.env['ANTHROPIC_API_KEY']) {
    console.error('ANTHROPIC_API_KEY environment variable is required for giti cycle');
    process.exit(1);
  }

  const spinner = options.json ? null : ora('Running lifecycle cycle...').start();
  try {
    const result = await runLifecycleCycle({
      repoPath,
      supervised: options.supervised ?? false,
    });
    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const outcomeColor = result.outcome === 'productive' ? chalk.green :
                           result.outcome === 'regression' ? chalk.red :
                           result.outcome === 'aborted' ? chalk.red : chalk.yellow;

      console.log(chalk.bold(`\n🔄 Lifecycle Cycle #${result.cycle}`));
      console.log(chalk.dim('─'.repeat(30)));
      console.log(`Outcome:    ${outcomeColor(result.outcome)}`);
      console.log(`Merged:     ${result.changes_merged}/${result.changes_attempted} changes`);
      console.log(`Approved:   ${result.changes_approved}`);
      console.log(`Rejected:   ${result.changes_rejected}`);
      console.log(`Duration:   ${(result.duration_ms / 1000).toFixed(1)}s`);
      console.log(`API tokens: ${result.api_tokens_used}`);
      if (result.regressions.length > 0) {
        console.log(chalk.red(`\nRegressions: ${result.regressions.join(', ')}`));
      }
    }
  } catch (error) {
    spinner?.fail('Lifecycle cycle failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
