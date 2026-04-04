import { getUserConfig, setUserConfig, getRecentEvents, clearEvents, readEvents } from '../telemetry/store.js';
import chalk from 'chalk';

export async function executeTelemetry(
  subcommand: string,
  options: { path?: string; json?: boolean; last?: string },
): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  switch (subcommand) {
    case 'on': {
      await setUserConfig({ enabled: true, first_prompt_shown: true });
      console.log(chalk.green('Telemetry enabled.'));
      break;
    }
    case 'off': {
      await setUserConfig({ enabled: false, first_prompt_shown: true });
      console.log(chalk.yellow('Telemetry disabled.'));
      break;
    }
    case 'status': {
      const config = await getUserConfig();
      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        console.log(chalk.bold('Telemetry Status'));
        console.log(`  Enabled: ${config.enabled ? chalk.green('yes') : chalk.red('no')}`);
        console.log(`  First prompt shown: ${config.first_prompt_shown ? 'yes' : 'no'}`);
        const events = await readEvents(repoPath);
        console.log(`  Events collected: ${events.length}`);
      }
      break;
    }
    case 'show': {
      const count = options.last ? parseInt(options.last, 10) : 10;
      const events = await getRecentEvents(repoPath, count);
      if (options.json) {
        console.log(JSON.stringify(events, null, 2));
      } else {
        if (events.length === 0) {
          console.log('No telemetry events collected.');
        } else {
          console.log(chalk.bold(`Last ${events.length} telemetry events:`));
          for (const event of events) {
            console.log(`  ${chalk.dim(event.timestamp)} ${event.command} ${event.flags_used.join(' ')} (${event.execution_time_ms}ms, exit ${event.exit_code})`);
          }
        }
      }
      break;
    }
    case 'clear': {
      await clearEvents(repoPath);
      console.log('Telemetry data cleared.');
      break;
    }
    default: {
      console.error(`Unknown subcommand: ${subcommand}. Use: on, off, status, show, clear`);
      process.exit(1);
    }
  }
}
