import type { GrowthProposal } from '../../agents/growth-hormone/types.js';
import type { ImplementationResult } from '../../agents/motor-cortex/types.js';
import type { CycleResult } from '../../agents/orchestrator/types.js';

export function formatReleaseNotes(params: {
  proposal: GrowthProposal;
  implementation: ImplementationResult;
  history: CycleResult[];
  currentVersion: string;
}): string {
  const { proposal, implementation, history, currentVersion } = params;
  const nextVersion = calculateNextVersion(currentVersion, true);
  const totalCycles = history.length;
  const totalMerged = history.reduce((s, c) => s + c.changes_merged, 0);
  const growthShipped = history.filter(c => c.outcome === 'productive').length;

  return [
    `## v${nextVersion} — ${proposal.title}`,
    '',
    `\uD83C\uDF31 This feature was autonomously discovered and implemented by the Living Codebase organism.`,
    '',
    `### What's New`,
    proposal.description,
    '',
    `### How It Was Discovered`,
    proposal.rationale,
    '',
    `### Evidence`,
    ...proposal.evidence.map(e => `- **${e.signal_type}:** ${e.data_point} (confidence: ${e.confidence})`),
    '',
    `### Implementation`,
    `- Branch: \`${implementation.branch_name}\``,
    `- Files modified: ${implementation.files_modified.length}`,
    `- Files created: ${implementation.files_created.length}`,
    `- Lines added: +${implementation.lines_added}`,
    `- Lines removed: -${implementation.lines_removed}`,
    '',
    `### Organism Stats`,
    `- Total autonomous cycles: ${totalCycles}`,
    `- Total changes merged: ${totalMerged}`,
    `- Growth features shipped: ${growthShipped}`,
    '',
    `---`,
    `*Released autonomously by the Living Codebase organism.*`,
  ].join('\n');
}

export function calculateNextVersion(current: string, isGrowthFeature: boolean): string {
  const parts = current.split('.').map(Number);
  if (parts.length !== 3) return current;
  const [major, minor, patch] = parts as [number, number, number];
  if (isGrowthFeature) {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}
