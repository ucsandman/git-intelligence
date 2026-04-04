import type { MilestoneType } from './types.js';
import type { CycleResult } from '../agents/orchestrator/types.js';
import type { KnowledgeBase } from '../agents/memory/types.js';

export function detectMilestone(
  result: CycleResult,
  history: CycleResult[],
  kb: KnowledgeBase | null,
): MilestoneType | undefined {
  const totalCycles = history.length + 1;
  const prevMerged = history.reduce((s, c) => s + c.changes_merged, 0);
  const totalMerged = prevMerged + result.changes_merged;

  // First cycle ever
  if (totalCycles === 1) return 'first-cycle';

  // First merge -- first time totalMerged reaches at least 1
  if (prevMerged === 0 && result.changes_merged > 0) return 'first-merge';

  // Merge milestones (check exact threshold crossings)
  for (const threshold of [10, 25, 50, 100] as const) {
    if (prevMerged < threshold && totalMerged >= threshold) {
      return `changes-${threshold}` as MilestoneType;
    }
  }

  // Growth proposal milestones (from KB)
  if (kb) {
    const proposedEvents = kb.events.filter(e => e.type === 'growth-proposed');
    const approvedEvents = kb.events.filter(e => e.type === 'growth-approved');
    const rejectedEvents = kb.events.filter(e => e.type === 'growth-rejected');

    // First growth proposal ever
    if (proposedEvents.length === 1 && proposedEvents[0]?.cycle === result.cycle) {
      return 'first-growth-proposal';
    }

    // First growth feature shipped (approved + merged in same cycle or prior)
    if (approvedEvents.length === 1 && approvedEvents[0]?.cycle === result.cycle) {
      return 'first-growth-shipped';
    }

    // First self-rejection
    if (rejectedEvents.length === 1 && rejectedEvents[0]?.cycle === result.cycle) {
      return 'first-self-rejection';
    }
  }

  // First self-fix: previous cycle had regression, this one merged fixes with no regression
  if (history.length > 0) {
    const prev = history[history.length - 1];
    if (
      prev &&
      prev.regressions.length > 0 &&
      result.changes_merged > 0 &&
      result.regressions.length === 0
    ) {
      // Check this hasn't happened before in history
      let firstTimeSelfFix = true;
      for (let i = history.length - 2; i >= 0; i--) {
        const h = history[i];
        const next = history[i + 1];
        if (
          h &&
          next &&
          h.regressions.length > 0 &&
          next.changes_merged > 0 &&
          next.regressions.length === 0
        ) {
          firstTimeSelfFix = false;
          break;
        }
      }
      if (firstTimeSelfFix) return 'first-self-fix';
    }
  }

  return undefined;
}
