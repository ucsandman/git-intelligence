import { runMotorCortex } from '../agents/motor-cortex/index.js';
import { formatBuildResult } from '../agents/motor-cortex/formatter.js';
import { loadLatestCyclePlan } from '../agents/prefrontal-cortex/backlog.js';
import ora from 'ora';

export async function executeBuild(itemId: string | undefined, options: { path?: string; json?: boolean; all?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  if (!process.env['ANTHROPIC_API_KEY']) {
    console.error('ANTHROPIC_API_KEY environment variable is required for giti build');
    process.exit(1);
  }

  const plan = await loadLatestCyclePlan(repoPath);
  if (!plan) {
    console.error('No cycle plan found. Run "giti plan" first.');
    process.exit(1);
  }

  const items = options.all ? plan.selected_items : plan.selected_items.filter(i => i.id === itemId);
  if (items.length === 0) {
    console.error(itemId ? `Work item ${itemId} not found in current plan.` : 'No items to build.');
    process.exit(1);
  }

  for (const item of items) {
    const spinner = options.json ? null : ora(`Building: ${item.title}...`).start();
    try {
      const result = await runMotorCortex(repoPath, item, plan.cycle_number);
      spinner?.stop();
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatBuildResult(result));
      }
    } catch (error) {
      spinner?.fail(`Build failed: ${item.title}`);
      console.error(error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
