import { runImmuneReview } from '../agents/immune-system/index.js';
import { formatReviewVerdict } from '../agents/immune-system/formatter.js';
import ora from 'ora';

export async function executeReview(branch: string, options: { path?: string; json?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();
  const spinner = options.json ? null : ora(`Reviewing branch: ${branch}...`).start();

  try {
    const { verdict } = await runImmuneReview(repoPath, branch);
    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify(verdict, null, 2));
    } else {
      console.log(formatReviewVerdict(verdict));
    }
  } catch (error) {
    spinner?.fail('Review failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
