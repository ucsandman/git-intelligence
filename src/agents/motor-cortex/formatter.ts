import chalk from 'chalk';
import type { ImplementationResult } from './types.js';

function checkIcon(pass: boolean): string {
  return pass ? chalk.green('✅') : chalk.red('❌');
}

export function formatBuildResult(result: ImplementationResult): string {
  const lines: string[] = [];

  const statusColor =
    result.status === 'success'
      ? chalk.green
      : result.status === 'partial'
        ? chalk.yellow
        : chalk.red;

  lines.push(chalk.bold(`🔧 Motor Cortex: ${statusColor(result.status)}`));
  lines.push(chalk.dim('────────────────────────────'));
  lines.push(`Task: ${result.work_item_id}`);
  lines.push(`Branch: ${result.branch_name}`);

  if (result.status === 'failed' && result.error) {
    lines.push('');
    lines.push(chalk.red(`Error: ${result.error}`));
    return lines.join('\n');
  }

  lines.push('');
  lines.push('Changes:');

  if (result.files_modified.length > 0) {
    const counts = `+${result.lines_added}/-${result.lines_removed}`;
    lines.push(`  Modified: ${result.files_modified.join(', ')} ${chalk.dim(counts)}`);
  } else {
    lines.push(`  Modified: (none)`);
  }

  lines.push(
    `  Created: ${result.files_created.length > 0 ? result.files_created.join(', ') : '(none)'}`,
  );
  lines.push(
    `  Deleted: ${result.files_deleted.length > 0 ? result.files_deleted.join(', ') : '(none)'}`,
  );
  lines.push(
    `  Tests: ${result.tests_added} added, ${result.tests_modified} modified`,
  );

  lines.push('');
  lines.push('Pre-review check:');
  lines.push(
    `  ${checkIcon(result.pre_review_check.lint_clean)} TypeScript compiles cleanly`,
  );
  lines.push(
    `  ${checkIcon(result.pre_review_check.tests_pass)} All tests pass`,
  );
  lines.push(
    `  ${checkIcon(result.pre_review_check.builds)} Build succeeds`,
  );

  lines.push('');
  lines.push(chalk.dim('Branch ready for Immune System review.'));
  lines.push(`API usage: ${result.claude_tokens_used} tokens`);

  return lines.join('\n');
}
