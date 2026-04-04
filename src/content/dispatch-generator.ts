import type { EvolutionDispatch } from './types.js';
import type { CycleResult } from '../agents/orchestrator/types.js';
import type { StateReport } from '../agents/sensory-cortex/types.js';
import type { CyclePlan } from '../agents/prefrontal-cortex/types.js';
import type { KnowledgeBase } from '../agents/memory/types.js';
import { detectMilestone } from './milestones.js';
import { generateNarrative, generateFallbackNarrative } from './narrative.js';
import { formatForTwitter, formatForLinkedIn, formatForHN, formatForBlog } from './platform-formatter.js';
import { calculateFitnessScore } from '../integrations/dashclaw/fitness.js';
import { ensureOrganismDir, getOrganismPath, writeJsonFile } from '../agents/utils.js';

export async function generateDispatch(params: {
  cycleResult: CycleResult;
  stateReport: StateReport;
  plan: CyclePlan | null;
  history: CycleResult[];
  kb: KnowledgeBase | null;
}): Promise<EvolutionDispatch> {
  const { cycleResult, stateReport, history, kb } = params;

  // Detect milestone
  const milestone = detectMilestone(cycleResult, history, kb)?.toString();

  // Calculate stats
  const currentFitness = calculateFitnessScore(stateReport, [...history, cycleResult]);
  const prevFitness = history.length > 0 ? calculateFitnessScore(stateReport, history) : currentFitness;
  const fitnessDelta = currentFitness - prevFitness;

  // Calculate streak
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.outcome === 'productive') streak++;
    else break;
  }
  if (cycleResult.outcome === 'productive') streak++;

  // Build narrative context
  const decisions = kb?.events
    .filter(e => e.cycle === cycleResult.cycle)
    .map(e => e.summary) ?? [];
  const growthProposals = kb?.events
    .filter(e => e.type === 'growth-proposed' && e.cycle === cycleResult.cycle)
    .map(e => (e.data['title'] as string) ?? e.summary) ?? [];
  const topLessons = kb?.lessons.sort((a, b) => b.confidence - a.confidence).slice(0, 3).map(l => l.lesson) ?? [];
  const preferences = kb?.preferences.map(p => p.preference) ?? [];

  // Generate narrative
  let narrativeResult;
  try {
    narrativeResult = await generateNarrative({
      cycleResult, decisions, growthProposals, topLessons, preferences, milestone,
    });
  } catch {
    narrativeResult = generateFallbackNarrative({
      cycleResult, decisions, growthProposals, topLessons, preferences, milestone,
    });
  }

  const stats: EvolutionDispatch['stats'] = {
    changes_merged: cycleResult.changes_merged,
    changes_rejected: cycleResult.changes_rejected,
    growth_proposals: growthProposals.length,
    fitness_delta: fitnessDelta,
    streak,
  };

  // Format for platforms
  const platform_versions = {
    twitter: formatForTwitter(narrativeResult.headline, stats, milestone),
    linkedin: formatForLinkedIn(narrativeResult.headline, narrativeResult.narrative, stats),
    hn: formatForHN(narrativeResult.headline, stats),
    blog: formatForBlog(narrativeResult.narrative, narrativeResult.key_moments, stats),
  };

  const dispatch: EvolutionDispatch = {
    cycle: cycleResult.cycle,
    timestamp: new Date().toISOString(),
    headline: narrativeResult.headline,
    narrative: narrativeResult.narrative,
    key_moments: narrativeResult.key_moments,
    stats,
    content_hooks: narrativeResult.content_hooks,
    milestone,
    platform_versions,
  };

  return dispatch;
}

export async function saveDispatch(repoPath: string, dispatch: EvolutionDispatch): Promise<string> {
  await ensureOrganismDir(repoPath, 'content', 'dispatches');
  const safeTs = dispatch.timestamp.replace(/:/g, '-');
  const filename = `cycle-${dispatch.cycle}-${safeTs}.json`;
  const filePath = getOrganismPath(repoPath, 'content', 'dispatches', filename);
  await writeJsonFile(filePath, dispatch);
  return filePath;
}
