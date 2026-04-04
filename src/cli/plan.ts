import { runSensoryCortex } from '../agents/sensory-cortex/index.js';
import { runPrefrontalCortex } from '../agents/prefrontal-cortex/index.js';
import { formatCyclePlan } from '../agents/prefrontal-cortex/formatter.js';
import ora from 'ora';

export async function executePlan(options: { path?: string; json?: boolean; dryRun?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();
  const spinner = options.json ? null : ora('Generating cycle plan...').start();

  try {
    // First run sensory cortex to get state
    if (spinner) spinner.text = 'Scanning repository state...';
    const { report } = await runSensoryCortex(repoPath);

    // Then run prefrontal cortex to generate plan
    if (spinner) spinner.text = 'Analyzing and prioritizing work items...';
    const plan = await runPrefrontalCortex(repoPath, report, options.dryRun);

    spinner?.stop();
    if (options.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(formatCyclePlan(plan));
      if (options.dryRun) {
        console.log('\n(dry run — plan not saved)');
      }
    }
  } catch (error) {
    spinner?.fail('Planning failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
