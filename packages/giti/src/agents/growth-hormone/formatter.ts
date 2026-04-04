import chalk from 'chalk';
import type { GrowthSignal, GrowthProposal } from './types.js';

const SEPARATOR = '───────────────────────────';

function confidenceColor(confidence: number): (text: string) => string {
  if (confidence > 0.7) return chalk.green;
  if (confidence >= 0.5) return chalk.yellow;
  return chalk.gray;
}

function confidenceLabel(confidence: number): string {
  const pct = Math.round(confidence * 100);
  const colorFn = confidenceColor(confidence);
  return colorFn(`${pct}%`);
}

export function formatGrowthReport(signals: GrowthSignal[], proposals: GrowthProposal[]): string {
  const lines: string[] = [];

  lines.push(chalk.bold('🌱 Growth Hormone Analysis'));
  lines.push(chalk.dim(SEPARATOR));

  if (signals.length === 0) {
    lines.push('No growth signals detected — organism is stable');
  } else {
    lines.push(`Telemetry signals detected: ${signals.length}`);
    lines.push('');
    signals.forEach((signal, i) => {
      const colorFn = confidenceColor(signal.confidence);
      lines.push(`  ${i + 1}. [${confidenceLabel(signal.confidence)}] ${colorFn(signal.title)}`);
      lines.push(`     Evidence: ${signal.evidence}`);
      if (i < signals.length - 1) lines.push('');
    });
  }

  lines.push('');

  if (proposals.length === 0) {
    lines.push('No proposals generated (insufficient evidence or all filtered)');
  } else {
    lines.push(`New proposals generated: ${proposals.length}`);
    lines.push('');
    proposals.forEach((proposal, i) => {
      lines.push(`  ${i + 1}. ${chalk.bold(proposal.title)}`);
      lines.push(`     Complexity: ${proposal.estimated_complexity}`);
      lines.push(`     Command: ${chalk.cyan(proposal.proposed_interface.command)}`);
      if (i < proposals.length - 1) lines.push('');
    });
  }

  lines.push('');
  lines.push(
    chalk.dim('Next: Proposals will be reviewed by Immune System, then scheduled by Prefrontal Cortex'),
  );

  return lines.join('\n');
}

export function formatProposalDetail(proposal: GrowthProposal): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`Proposal: ${proposal.title}`));
  lines.push(chalk.dim(SEPARATOR));
  lines.push(`ID:          ${chalk.dim(proposal.id)}`);
  lines.push(`Timestamp:   ${chalk.dim(proposal.timestamp)}`);
  lines.push(`Status:      ${formatStatus(proposal.status)}`);
  lines.push(`Complexity:  ${formatComplexity(proposal.estimated_complexity)}`);
  lines.push('');

  lines.push(chalk.bold('Description'));
  lines.push(`  ${proposal.description}`);
  lines.push('');

  lines.push(chalk.bold('Rationale'));
  lines.push(`  ${proposal.rationale}`);
  lines.push('');

  lines.push(chalk.bold('Proposed Interface'));
  lines.push(`  Command: ${chalk.cyan(proposal.proposed_interface.command)}`);
  if (proposal.proposed_interface.flags.length > 0) {
    lines.push(`  Flags:   ${proposal.proposed_interface.flags.join(', ')}`);
  }
  lines.push(`  Output:  ${proposal.proposed_interface.output_description}`);
  lines.push('');

  lines.push(chalk.bold('Evidence'));
  for (const ev of proposal.evidence) {
    const colorFn = confidenceColor(ev.confidence);
    lines.push(`  [${colorFn(`${Math.round(ev.confidence * 100)}%`)}] (${ev.signal_type}) ${ev.data_point}`);
  }
  lines.push('');

  lines.push(chalk.bold('Alignment'));
  lines.push(`  Purpose:      ${proposal.alignment.purpose_alignment}`);
  lines.push(`  Growth Zone:  ${proposal.alignment.growth_zone_category}`);
  if (proposal.alignment.principle_compliance.length > 0) {
    lines.push('  Principles:');
    for (const p of proposal.alignment.principle_compliance) {
      lines.push(`    - ${p}`);
    }
  }
  lines.push('');

  if (proposal.target_files.length > 0) {
    lines.push(chalk.bold('Target Files'));
    for (const f of proposal.target_files) {
      lines.push(`  - ${f}`);
    }
    lines.push('');
  }

  if (proposal.dependencies_needed.length > 0) {
    lines.push(chalk.bold('Dependencies Needed'));
    for (const d of proposal.dependencies_needed) {
      lines.push(`  - ${d}`);
    }
    lines.push('');
  }

  if (proposal.risks.length > 0) {
    lines.push(chalk.bold('Risks'));
    for (const r of proposal.risks) {
      lines.push(`  - ${chalk.yellow(r)}`);
    }
    lines.push('');
  }

  if (proposal.success_metrics.length > 0) {
    lines.push(chalk.bold('Success Metrics'));
    for (const m of proposal.success_metrics) {
      lines.push(`  - ${m}`);
    }
    lines.push('');
  }

  if (proposal.immune_system_notes) {
    lines.push(chalk.bold('Immune System Notes'));
    lines.push(`  ${chalk.italic(proposal.immune_system_notes)}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatStatus(status: GrowthProposal['status']): string {
  switch (status) {
    case 'proposed':
      return chalk.yellow('proposed');
    case 'approved':
      return chalk.green('approved');
    case 'rejected':
      return chalk.red('rejected');
    case 'implemented':
      return chalk.blue('implemented');
  }
}

function formatComplexity(complexity: GrowthProposal['estimated_complexity']): string {
  switch (complexity) {
    case 'small':
      return chalk.green('small');
    case 'medium':
      return chalk.yellow('medium');
    case 'large':
      return chalk.red('large');
  }
}
