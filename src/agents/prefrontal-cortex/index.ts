import type { StateReport } from '../sensory-cortex/types.js';
import type { CyclePlan } from './types.js';
import { loadOrganismConfig, readJsonFile, getOrganismPath } from '../utils.js';
import { loadKnowledgeBase } from '../memory/store.js';
import { loadBacklog, saveWorkItem, saveCyclePlan } from './backlog.js';
import { generateWorkItems, prioritizeItems } from './prioritizer.js';

interface CooldownFile {
  until: string;
}

interface CycleCounterFile {
  count: number;
}

/**
 * Check if two work item titles are similar enough to be considered duplicates.
 * Uses simple lowercased substring containment as a lightweight heuristic.
 */
function isTitleSimilar(a: string, b: string): boolean {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  return la === lb || la.includes(lb) || lb.includes(la);
}

/**
 * Run the Prefrontal Cortex agent: load context, generate and prioritize work
 * items, assemble a CyclePlan, and optionally persist results to disk.
 */
export async function runPrefrontalCortex(
  repoPath: string,
  stateReport: StateReport,
  dryRun: boolean = false,
): Promise<CyclePlan> {
  // Step 1: Load organism config
  const config = await loadOrganismConfig(repoPath);

  // Step 2: Load knowledge base (may be empty but never null)
  const kb = await loadKnowledgeBase(repoPath);

  // Step 3: Load existing backlog items, keep only 'proposed' ones
  const allBacklog = await loadBacklog(repoPath);
  const existingItems = allBacklog.filter((item) => item.status === 'proposed');

  // Step 4: Check cooldown
  const cooldownData = await readJsonFile<CooldownFile>(
    getOrganismPath(repoPath, 'cooldown-until.json'),
  );
  const inCooldown =
    cooldownData != null &&
    typeof cooldownData.until === 'string' &&
    new Date(cooldownData.until) > new Date();

  // Step 5: Generate new work items from the current state report
  const newItems = generateWorkItems(stateReport, config, kb);

  // Step 6: Merge new items with existing backlog (skip duplicates by title similarity)
  const deduped = newItems.filter(
    (newItem) =>
      !existingItems.some((existing) => isTitleSimilar(newItem.title, existing.title)),
  );
  const allItems = [...existingItems, ...deduped];

  // Step 7: Prioritize
  const maxItems = config.lifecycle.max_changes_per_cycle;
  const { selected, deferred } = prioritizeItems(allItems, maxItems, inCooldown);

  // Step 8: Determine cycle number
  const counterData = await readJsonFile<CycleCounterFile>(
    getOrganismPath(repoPath, 'cycle-counter.json'),
  );
  const cycleNumber = counterData?.count ?? 1;

  // Step 9: Estimate overall risk
  const fragilePathSet = new Set(kb.patterns.fragile_files.map((f) => f.path));

  let estimatedRisk: 'low' | 'medium' | 'high' = 'low';
  for (const item of selected) {
    if (item.target_files.some((f) => fragilePathSet.has(f))) {
      estimatedRisk = 'high';
      break;
    }
    if (item.tier <= 2) {
      estimatedRisk = 'medium';
    }
  }

  // Step 10: Assemble CyclePlan
  const plan: CyclePlan = {
    cycle_number: cycleNumber,
    timestamp: new Date().toISOString(),
    state_report_id: stateReport.timestamp,
    selected_items: selected,
    deferred_items: deferred,
    rationale: inCooldown
      ? 'Organism is in cooldown — only critical and regression-repair items selected'
      : 'Standard prioritization based on tier and priority score',
    estimated_risk: estimatedRisk,
    memory_consulted: kb.lessons.length > 0 || kb.patterns.fragile_files.length > 0,
  };

  // Step 11: Persist if not dry run
  if (!dryRun) {
    await saveCyclePlan(repoPath, plan);
    for (const item of deduped) {
      await saveWorkItem(repoPath, item);
    }
  }

  // Step 12: Return plan
  return plan;
}
