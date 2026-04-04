import { runSensoryCortex } from '../agents/sensory-cortex/index.js';
import { formatSenseReport } from '../agents/sensory-cortex/formatter.js';
import ora from 'ora';

export async function executeSense(options: { path?: string; json?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();
  const spinner = options.json ? null : ora('Running sensory scan...').start();

  try {
    const { report, reportPath } = await runSensoryCortex(repoPath);
    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatSenseReport(report, reportPath));
    }
  } catch (error) {
    spinner?.fail('Sensory scan failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
