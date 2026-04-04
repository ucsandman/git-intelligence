import crypto from 'node:crypto';
import type { StateReport } from '../sensory-cortex/types.js';
import type { OrganismConfig } from '../types.js';
import type { KnowledgeBase } from '../memory/types.js';
import type { WorkItem } from './types.js';
import type { GrowthProposal } from '../growth-hormone/types.js';

/**
 * Parse a performance budget string like "< 2 seconds on repos up to 10k commits"
 * into milliseconds. Returns null if unparseable.
 */
function parseBudgetMs(budget: string): number | null {
  const match = budget.match(/<\s*([\d.]+)\s*seconds?/i);
  if (!match) return null;
  return parseFloat(match[1]!) * 1000;
}

/**
 * Map a performance field name to the config budget key.
 */
const PERF_FIELD_TO_BUDGET: Record<string, string> = {
  pulse_execution_ms: 'pulse_command',
  hotspots_execution_ms: 'hotspots_command',
  ghosts_execution_ms: 'any_new_command',
};

/**
 * Check if any target files appear in the KB's fragile files list.
 * Returns matching lesson IDs and a note string.
 */
function consultKb(
  targetFiles: string[],
  kb: KnowledgeBase | null,
): { lessonIds: string[]; note: string } {
  if (!kb) return { lessonIds: [], note: '' };

  const fragileSet = new Set(kb.patterns.fragile_files.map((f) => f.path));
  const matchingFiles = targetFiles.filter((f) => fragileSet.has(f));

  if (matchingFiles.length === 0) return { lessonIds: [], note: '' };

  const lessonIds = kb.lessons.map((l) => l.id);
  const note = ` (WARNING: targets fragile file(s): ${matchingFiles.join(', ')})`;
  return { lessonIds, note };
}

/**
 * Create a WorkItem with defaults and KB context applied.
 */
function createItem(
  fields: Omit<WorkItem, 'id' | 'created_by' | 'status' | 'memory_context'> & {
    target_files: string[];
  },
  kb: KnowledgeBase | null,
): WorkItem {
  const { lessonIds, note } = consultKb(fields.target_files, kb);

  return {
    id: crypto.randomUUID(),
    created_by: 'prefrontal-cortex',
    status: 'proposed',
    memory_context: lessonIds,
    ...fields,
    description: fields.description + note,
  };
}

/**
 * Scan each section of the StateReport and generate WorkItems organized by tier.
 */
export function generateWorkItems(
  stateReport: StateReport,
  config: OrganismConfig,
  kb: KnowledgeBase | null,
): WorkItem[] {
  const items: WorkItem[] = [];

  // ── Tier 1: Critical ──────────────────────────────────────────────

  if (stateReport.dependencies.vulnerable_count > 0) {
    const count = stateReport.dependencies.vulnerable_count;
    items.push(
      createItem(
        {
          tier: 1,
          priority_score: 100,
          title: `Fix ${count} security vulnerabilit${count === 1 ? 'y' : 'ies'}`,
          description: `Found ${count} security vulnerabilit${count === 1 ? 'y' : 'ies'} in dependencies`,
          rationale: 'Security vulnerabilities must be addressed immediately',
          target_files: ['package.json'],
          estimated_complexity: 'medium',
          success_criteria: ['npm audit shows 0 vulnerabilities'],
        },
        kb,
      ),
    );
  }

  if (stateReport.quality.lint_error_count > 0) {
    const count = stateReport.quality.lint_error_count;
    items.push(
      createItem(
        {
          tier: 1,
          priority_score: 95,
          title: `Fix ${count} lint error${count === 1 ? '' : 's'}`,
          description: `Found ${count} lint error${count === 1 ? '' : 's'} that must be resolved`,
          rationale: 'Lint errors indicate code quality issues that block CI',
          target_files: [],
          estimated_complexity: 'medium',
          success_criteria: ['Lint passes with 0 errors'],
        },
        kb,
      ),
    );
  }

  if (stateReport.quality.test_pass_rate < 1) {
    items.push(
      createItem(
        {
          tier: 1,
          priority_score: 90,
          title: 'Fix failing tests',
          description: `Test pass rate is ${(stateReport.quality.test_pass_rate * 100).toFixed(1)}%, needs to be 100%`,
          rationale: 'Failing tests indicate broken functionality',
          target_files: [],
          estimated_complexity: 'medium',
          success_criteria: ['All tests pass (100% pass rate)'],
        },
        kb,
      ),
    );
  }

  // ── Tier 2: Regression repair ─────────────────────────────────────

  // Performance budget checks
  const perfFields: Array<{ field: keyof StateReport['performance']; label: string }> = [
    { field: 'pulse_execution_ms', label: 'pulse' },
    { field: 'hotspots_execution_ms', label: 'hotspots' },
    { field: 'ghosts_execution_ms', label: 'ghosts' },
  ];

  for (const { field, label } of perfFields) {
    const actual = stateReport.performance[field];
    if (typeof actual !== 'number') continue;

    const budgetKey = PERF_FIELD_TO_BUDGET[field];
    if (!budgetKey) continue;

    const budgetStr = config.quality_standards.performance_budget[budgetKey];
    if (!budgetStr) continue;

    const budgetMs = parseBudgetMs(budgetStr);
    if (budgetMs === null) continue;

    if (actual > budgetMs * 0.8) {
      const rawScore = Math.round((actual / budgetMs) * 100);
      const score = Math.min(rawScore, 100);

      items.push(
        createItem(
          {
            tier: 2,
            priority_score: score,
            title: `Optimize ${label} command performance`,
            description: `${label} command takes ${actual}ms, budget is ${budgetMs}ms (${Math.round((actual / budgetMs) * 100)}% of budget)`,
            rationale: 'Performance exceeds 80% of budget threshold',
            target_files: [],
            estimated_complexity: 'medium',
            success_criteria: [`${label} command executes under ${budgetMs}ms`],
          },
          kb,
        ),
      );
    }
  }

  // Coverage below floor
  const coverageFloor = config.quality_standards.test_coverage_floor;
  if (stateReport.quality.test_coverage_percent < coverageFloor) {
    items.push(
      createItem(
        {
          tier: 2,
          priority_score: 80,
          title: `Increase test coverage from ${stateReport.quality.test_coverage_percent}% to ${coverageFloor}%`,
          description: `Test coverage is ${stateReport.quality.test_coverage_percent}%, below the floor of ${coverageFloor}%`,
          rationale: 'Test coverage below minimum standard',
          target_files: [],
          estimated_complexity: 'medium',
          success_criteria: [`Test coverage >= ${coverageFloor}%`],
        },
        kb,
      ),
    );
  }

  // Critical anomalies
  for (const anomaly of stateReport.anomalies) {
    if (anomaly.severity === 'critical') {
      items.push(
        createItem(
          {
            tier: 2,
            priority_score: 85,
            title: `Resolve critical anomaly: ${anomaly.message}`,
            description: `Critical ${anomaly.type} anomaly detected: ${anomaly.message}`,
            rationale: 'Critical anomalies require immediate attention',
            target_files: [],
            estimated_complexity: 'small',
            success_criteria: ['Anomaly no longer detected in subsequent scan'],
          },
          kb,
        ),
      );
    }
  }

  // ── Tier 3: Quality improvement ───────────────────────────────────

  // Outdated packages (patch/minor only)
  for (const pkg of stateReport.dependencies.outdated_packages) {
    if (pkg.severity === 'major') continue;

    const priorityScore = pkg.severity === 'patch' ? 30 : 50;
    items.push(
      createItem(
        {
          tier: 3,
          priority_score: priorityScore,
          title: `Update ${pkg.name} from ${pkg.current} to ${pkg.latest}`,
          description: `${pkg.severity} update available for ${pkg.name}: ${pkg.current} → ${pkg.latest}`,
          rationale: `Keeping dependencies current reduces technical debt (${pkg.severity} update)`,
          target_files: ['package.json'],
          estimated_complexity: 'trivial',
          success_criteria: [`${pkg.name} updated to ${pkg.latest}`, 'All tests pass after update'],
        },
        kb,
      ),
    );
  }

  // Files exceeding length limit
  for (const file of stateReport.quality.files_exceeding_length_limit) {
    items.push(
      createItem(
        {
          tier: 3,
          priority_score: 40,
          title: `Split/reduce ${file}`,
          description: `File ${file} exceeds the maximum length limit of ${config.quality_standards.max_file_length} lines`,
          rationale: 'Large files are harder to maintain and review',
          target_files: [file],
          estimated_complexity: 'small',
          success_criteria: [`${file} is under ${config.quality_standards.max_file_length} lines`],
        },
        kb,
      ),
    );
  }

  // Functions exceeding complexity
  for (const fn of stateReport.quality.functions_exceeding_complexity) {
    items.push(
      createItem(
        {
          tier: 3,
          priority_score: 35,
          title: `Reduce complexity in ${fn}`,
          description: `Function ${fn} exceeds complexity threshold of ${config.quality_standards.max_complexity_per_function}`,
          rationale: 'High complexity functions are error-prone and hard to test',
          target_files: [],
          estimated_complexity: 'small',
          success_criteria: [`${fn} complexity is under ${config.quality_standards.max_complexity_per_function}`],
        },
        kb,
      ),
    );
  }

  return items;
}

/**
 * Convert approved GrowthProposals into Tier 5 WorkItems.
 */
export function generateGrowthItems(proposals: GrowthProposal[], kb: KnowledgeBase | null): WorkItem[] {
  return proposals.map(p => createItem({
    tier: 5 as const,
    priority_score: Math.round(
      p.evidence.reduce((sum, e) => sum + e.confidence, 0) / Math.max(p.evidence.length, 1) * 100
    ),
    title: p.title,
    description: p.description,
    rationale: p.rationale,
    target_files: p.target_files,
    estimated_complexity: p.estimated_complexity === 'small' ? 'small' : p.estimated_complexity === 'medium' ? 'medium' : 'large',
    success_criteria: p.success_metrics,
  }, kb));
}

/**
 * Prioritize work items by tier and score, applying cooldown filtering and maxItems cap.
 */
export function prioritizeItems(
  items: WorkItem[],
  maxItems: number,
  inCooldown: boolean,
): { selected: WorkItem[]; deferred: WorkItem[] } {
  // Filter during cooldown: only Tier 1 and Tier 2
  let eligible: WorkItem[];
  let cooldownDeferred: WorkItem[];

  if (inCooldown) {
    eligible = items.filter((i) => i.tier <= 2);
    cooldownDeferred = items.filter((i) => i.tier > 2);
  } else {
    eligible = [...items];
    cooldownDeferred = [];
  }

  // Sort: tier ascending, then priority_score descending within tier
  eligible.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.priority_score - a.priority_score;
  });

  const selected = eligible.slice(0, maxItems);
  const deferredFromCap = eligible.slice(maxItems);

  // Set selected items' status to 'planned'
  for (const item of selected) {
    item.status = 'planned';
  }

  return {
    selected,
    deferred: [...deferredFromCap, ...cooldownDeferred],
  };
}
