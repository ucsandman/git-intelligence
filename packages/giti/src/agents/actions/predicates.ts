import type { ActionPlanningContext, PredicateDefinition } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getValueAtPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }
    return current[segment];
  }, source);
}

function getEvents(context: ActionPlanningContext): Array<Record<string, unknown>> {
  const memory = context.memory;
  if (!isRecord(memory) || !Array.isArray(memory.events)) {
    return [];
  }
  return memory.events.filter(isRecord);
}

function getLessons(context: ActionPlanningContext): Array<Record<string, unknown>> {
  const memory = context.memory;
  if (!isRecord(memory) || !Array.isArray(memory.lessons)) {
    return [];
  }
  return memory.lessons.filter(isRecord);
}

function getBoundaryPaths(
  context: ActionPlanningContext,
  boundary: 'growth_zone' | 'forbidden_zone',
): string[] {
  const config = context.config;
  if (!isRecord(config) || !isRecord(config.boundaries)) {
    return [];
  }

  const value = config.boundaries[boundary];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function evaluatePredicate(
  predicate: PredicateDefinition,
  context: ActionPlanningContext,
): boolean {
  switch (predicate.type) {
    case 'metric_gt': {
      const value = getValueAtPath(context.state_report, predicate.metric);
      return typeof value === 'number' && value > predicate.value;
    }
    case 'metric_lt': {
      const value = getValueAtPath(context.state_report, predicate.metric);
      return typeof value === 'number' && value < predicate.value;
    }
    case 'event_count_since': {
      const sinceTime = new Date(predicate.since).getTime();
      const count = getEvents(context).filter((event) => {
        return (
          event.type === predicate.event_type &&
          typeof event.timestamp === 'string' &&
          new Date(event.timestamp).getTime() >= sinceTime
        );
      }).length;
      return count >= predicate.min_count;
    }
    case 'lesson_confidence_gte':
      return getLessons(context).some((lesson) => {
        if (typeof lesson.confidence !== 'number' || lesson.confidence < predicate.min_confidence) {
          return false;
        }
        if (predicate.category === undefined) {
          return true;
        }
        return lesson.category === predicate.category;
      });
    case 'file_matches_boundary': {
      const prefixes = getBoundaryPaths(context, predicate.boundary);
      const matches = predicate.paths.map((filePath) =>
        prefixes.some((prefix) => filePath.startsWith(prefix)),
      );
      return predicate.match === 'all' ? matches.every(Boolean) : matches.some(Boolean);
    }
    case 'branch_is_clean': {
      const runtime = context.runtime;
      return isRecord(runtime) && runtime.branch_clean === predicate.expected;
    }
    case 'cooldown_inactive': {
      const runtime = context.runtime;
      return isRecord(runtime) && runtime.in_cooldown === false;
    }
    case 'budget_available': {
      const runtime = context.runtime;
      return (
        isRecord(runtime) &&
        typeof runtime.api_budget_remaining === 'number' &&
        runtime.api_budget_remaining >= predicate.minimum_remaining
      );
    }
    case 'integration_configured': {
      const runtime = context.runtime;
      return (
        isRecord(runtime) &&
        isRecord(runtime.integrations) &&
        runtime.integrations[predicate.integration] === true
      );
    }
  }
}

export function evaluatePredicates(
  predicates: PredicateDefinition[],
  context: ActionPlanningContext,
): { passed: boolean; failed: string[] } {
  const failed = predicates
    .filter((predicate) => !evaluatePredicate(predicate, context))
    .map((predicate) => predicate.type);

  return {
    passed: failed.length === 0,
    failed,
  };
}
