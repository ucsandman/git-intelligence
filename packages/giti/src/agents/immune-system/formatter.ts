import chalk from 'chalk';
import type { ReviewVerdict } from './types.js';

function verdictLabel(verdict: ReviewVerdict['verdict']): string {
  switch (verdict) {
    case 'approve':
      return chalk.green('\u2705 APPROVED');
    case 'reject':
      return chalk.red('\u274C REJECTED');
    case 'request-changes':
      return chalk.yellow('\u26A0\uFE0F  CHANGES REQUESTED');
  }
}

function checkIcon(status: 'pass' | 'fail' | 'warn'): string {
  switch (status) {
    case 'pass':
      return '\u2705';
    case 'fail':
      return '\u274C';
    case 'warn':
      return '\u26A0\uFE0F';
  }
}

function riskIcon(severity: 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'low':
      return '\uD83D\uDFE2';
    case 'medium':
      return '\uD83D\uDFE1';
    case 'high':
      return '\uD83D\uDD34';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatReviewVerdict(verdict: ReviewVerdict): string {
  const divider = '\u2500'.repeat(58);

  const lines: string[] = [
    '',
    `\uD83D\uDEE1\uFE0F  Immune System Review: ${verdict.branch}`,
    divider,
    `Verdict: ${verdictLabel(verdict.verdict)} (confidence: ${verdict.confidence})`,
    '',
    'Checks:',
  ];

  for (const check of verdict.checks) {
    const icon = checkIcon(check.status);
    const paddedName = check.name.padEnd(14);
    lines.push(`  ${icon} ${paddedName}\u2014 ${check.message}`);
  }

  if (verdict.risks.length > 0) {
    lines.push('');
    lines.push('Risks:');
    for (const risk of verdict.risks) {
      const icon = riskIcon(risk.severity);
      lines.push(`  ${icon} ${capitalize(risk.severity)}: ${risk.description}`);
    }
  }

  lines.push('');
  lines.push(`Recommendation: ${verdict.recommendation}`);

  // Build the file reference
  const branchSlug = verdict.branch.replace(/\//g, '-');
  const tsSlug = verdict.timestamp.replace(/:/g, '-');
  lines.push('');
  lines.push(`Full verdict: .organism/reviews/${branchSlug}-${tsSlug}.json`);
  lines.push('');

  return lines.join('\n');
}
