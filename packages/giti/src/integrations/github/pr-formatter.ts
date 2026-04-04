import type { WorkItem } from '../../agents/prefrontal-cortex/types.js';
import type { ReviewVerdict } from '../../agents/immune-system/types.js';
import type { StateReport } from '../../agents/sensory-cortex/types.js';

export function formatPRBody(params: {
  workItem: WorkItem;
  cycleNumber: number;
  verdict: ReviewVerdict;
  stateReport: StateReport;
  dashclawUrl?: string;
}): string {
  const { workItem, cycleNumber, verdict, stateReport, dashclawUrl } = params;

  const checksLines = verdict.checks
    .map(c => {
      const icon = c.status === 'pass' ? '\u2705' : c.status === 'warn' ? '\u26A0\uFE0F' : '\u274C';
      return `- ${icon} ${c.name}: ${c.message}`;
    })
    .join('\n');

  const verdictIcon =
    verdict.verdict === 'approve'
      ? '\u2705 APPROVED'
      : verdict.verdict === 'reject'
        ? '\u274C REJECTED'
        : '\u26A0\uFE0F CHANGES REQUESTED';

  let body = `## \uD83E\uDDEC Organism Change: ${workItem.title}\n\n`;
  body += `**Agent:** Motor Cortex\n`;
  body += `**Cycle:** #${cycleNumber}\n`;
  body += `**Work Item Tier:** ${workItem.tier}\n\n`;
  body += `### What Changed\n${workItem.description}\n\n`;
  body += `### Why\n${workItem.rationale}\n\n`;
  body += `### Immune System Review\n${checksLines}\n\n`;
  body += `**Verdict:** ${verdictIcon} (confidence: ${verdict.confidence})\n\n`;

  if (workItem.memory_context.length > 0) {
    body += `### Memory Context\nRelevant lessons: ${workItem.memory_context.join(', ')}\n\n`;
  }

  body += `### Metrics\n`;
  body += `| Metric | Value |\n|--------|-------|\n`;
  body += `| Test Coverage | ${stateReport.quality.test_coverage_percent}% |\n`;
  body += `| Lint Errors | ${stateReport.quality.lint_error_count} |\n`;
  body += `| Pulse Perf | ${stateReport.performance.pulse_execution_ms}ms |\n\n`;

  body += `---\n*This PR was created autonomously by the Living Codebase organism.*\n`;
  if (dashclawUrl) body += `*[View the organism's dashboard](${dashclawUrl})*\n`;

  return body;
}

export function formatPRTitle(workItem: WorkItem, cycleNumber: number): string {
  return `organism(cycle-${cycleNumber}): ${workItem.title}`;
}

export function getPRLabels(workItem: WorkItem): string[] {
  return ['organism', 'auto-generated', `tier-${workItem.tier}`];
}
