import chalk from 'chalk';
import type { CyclePlan, WorkItem } from './types.js';

function tierColor(tier: WorkItem['tier']): (text: string) => string {
  switch (tier) {
    case 1:
      return chalk.red;
    case 2:
      return chalk.yellow;
    case 3:
      return chalk.green;
    default:
      return chalk.cyan;
  }
}

function formatTierBadge(tier: WorkItem['tier']): string {
  return tierColor(tier)(`[Tier ${tier}]`);
}

export function formatCyclePlan(plan: CyclePlan): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`🧠 Cycle Plan #${plan.cycle_number}`));
  lines.push(chalk.dim('─────────────────'));
  lines.push(`Based on: state report ${plan.state_report_id}`);
  lines.push(`Organism status: ${plan.estimated_risk === 'high' ? 'in cooldown' : 'healthy'}`);
  lines.push('');

  if (plan.selected_items.length === 0) {
    lines.push('No work items — organism is stable');
  } else {
    lines.push(`Planned work (${plan.selected_items.length} items):`);
    lines.push('');

    for (let i = 0; i < plan.selected_items.length; i++) {
      const item = plan.selected_items[i]!;
      lines.push(`  ${i + 1}. ${formatTierBadge(item.tier)} ${item.title}`);
      lines.push(`     Rationale: ${item.rationale}`);
      lines.push(`     Target: ${item.target_files.length > 0 ? item.target_files.join(', ') : '(none)'}`);
      lines.push(`     Complexity: ${item.estimated_complexity}`);
      if (i < plan.selected_items.length - 1) {
        lines.push('');
      }
    }
  }

  if (plan.deferred_items.length > 0) {
    lines.push('');
    lines.push('Deferred:');
    for (const item of plan.deferred_items) {
      lines.push(`  - ${formatTierBadge(item.tier)} ${item.title}`);
    }
  }

  lines.push('');
  lines.push(`Estimated cycle risk: ${plan.estimated_risk}`);

  return lines.join('\n');
}
