import crypto from 'node:crypto';
import { loadActionPlanningContext } from './context.js';
import { evaluatePredicates } from './predicates.js';
import { listActionTemplates } from './registry.js';
import type {
  ActionInstance,
  ActionPlanningContext,
  ActionRecommendation,
  ActionTemplate,
} from './types.js';
import type { StateReport } from '../sensory-cortex/types.js';

interface PlanActionsOptions {
  templates?: unknown[];
  context?: ActionPlanningContext;
  limit?: number;
}

function getMetricValue(context: ActionPlanningContext, metric: string): number | undefined {
  return metric.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, context.state_report) as number | undefined;
}

function computeTriggerBonus(template: ActionTemplate, context: ActionPlanningContext): number {
  return template.triggers.reduce((bonus, trigger) => {
    switch (trigger.type) {
      case 'metric_gt': {
        const value = getMetricValue(context, trigger.metric);
        return bonus + (typeof value === 'number' ? Math.max(value - trigger.value, 0) : 0);
      }
      case 'metric_lt': {
        const value = getMetricValue(context, trigger.metric);
        return bonus + (typeof value === 'number' ? Math.max(trigger.value - value, 0) : 0);
      }
      case 'event_count_since':
        return bonus + trigger.min_count * 10;
      case 'lesson_confidence_gte':
        return bonus + trigger.min_confidence * 10;
      case 'integration_configured':
      case 'budget_available':
      case 'cooldown_inactive':
      case 'branch_is_clean':
      case 'file_matches_boundary':
        return bonus + 5;
    }
  }, 0);
}

function getRiskPenalty(template: ActionTemplate): number {
  switch (template.risk) {
    case 'read_only':
      return 0;
    case 'low':
      return 5;
    case 'medium':
      return 15;
    case 'high':
      return 30;
  }
}

export function scoreActionCandidate(
  template: ActionTemplate,
  context: ActionPlanningContext,
): number {
  const triggerBonus = computeTriggerBonus(template, context);
  const baseScore = 50 + triggerBonus;
  return Math.max(1, Number((baseScore - getRiskPenalty(template)).toFixed(2)));
}

export function buildActionInstance(
  template: ActionTemplate,
  context: ActionPlanningContext,
): ActionInstance {
  return {
    id: crypto.randomUUID(),
    template_id: template.id,
    template_version: template.version,
    status: 'planned',
    bound_inputs: {
      repo_path: context.repo_path,
      state_report: context.state_report ?? {},
      memory: context.memory ?? {},
      config: context.config ?? {},
      runtime: context.runtime ?? {},
    },
    step_results: [],
  };
}

export async function planActions(
  repoPath: string,
  stateReport: StateReport,
  options: PlanActionsOptions = {},
): Promise<ActionRecommendation[]> {
  const context = options.context ?? (await loadActionPlanningContext(repoPath, stateReport));
  const templates = listActionTemplates(options.templates);
  const eligible = templates
    .map((template) => {
      const triggers = evaluatePredicates(template.triggers, context);
      if (!triggers.passed) {
        return null;
      }

      const constraints = evaluatePredicates(
        template.constraints
          .filter((constraint) => constraint.type === 'predicate')
          .map((constraint) => constraint.predicate),
        context,
      );
      if (!constraints.passed) {
        return null;
      }

      return {
        template,
        score: scoreActionCandidate(template, context),
        rationale: [
          `triggered:${template.triggers.length}`,
          ...template.triggers.map((trigger) => trigger.type),
        ],
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.score - a.score);

  return eligible.slice(0, options.limit ?? 5).map(({ template, score, rationale }) => ({
    template_id: template.id,
    template_version: template.version,
    score,
    rationale,
    risk: template.risk,
  }));
}
