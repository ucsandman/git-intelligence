import type {
  ActionEffect,
  ActionInstance,
  ActionInstanceStatus,
  ActionRisk,
  ActionStep,
  ActionStepType,
  ActionTemplate,
  ActionTemplateStatus,
  ConstraintDefinition,
  InputDefinition,
  LearningHook,
  PredicateDefinition,
  RollbackDefinition,
  StepExecutionResult,
  SuccessCriterion,
} from './types.js';

const ACTION_TEMPLATE_STATUSES: ActionTemplateStatus[] = ['active', 'deprecated', 'disabled'];
const ACTION_INSTANCE_STATUSES: ActionInstanceStatus[] = [
  'planned',
  'approved',
  'running',
  'succeeded',
  'failed',
  'rejected',
];
const ACTION_RISKS: ActionRisk[] = ['read_only', 'low', 'medium', 'high'];
const ACTION_EFFECTS: ActionEffect[] = [
  'writes_files',
  'creates_branch',
  'opens_issue',
  'records_memory',
  'calls_external_api',
];
const ACTION_STEP_TYPES: ActionStepType[] = [
  'read_repo_state',
  'query_memory',
  'evaluate_predicate',
  'select_targets',
  'generate_artifact',
  'write_artifact',
  'create_git_branch',
  'run_safe_check',
  'open_github_issue',
  'record_event',
  'record_lesson',
];
const BOUNDARY_MATCH_VALUES = ['any', 'all'] as const;

const WRITE_EFFECTS = new Set<ActionEffect>([
  'writes_files',
  'creates_branch',
  'opens_issue',
  'calls_external_api',
]);

const WRITE_STEP_TYPES = new Set<ActionStepType>([
  'write_artifact',
  'create_git_branch',
  'open_github_issue',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureString(value: unknown, label: string): string {
  ensure(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  return value;
}

function ensureNumber(value: unknown, label: string): number {
  ensure(typeof value === 'number' && Number.isFinite(value), `${label} must be a finite number`);
  return value;
}

function ensureBoolean(value: unknown, label: string): boolean {
  ensure(typeof value === 'boolean', `${label} must be a boolean`);
  return value;
}

function ensureStringArray(value: unknown, label: string): string[] {
  ensure(Array.isArray(value), `${label} must be an array`);
  return value.map((entry, index) => ensureString(entry, `${label}[${index}]`));
}

function assertOneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  ensure(typeof value === 'string' && allowed.includes(value as T), `${label} must be one of: ${allowed.join(', ')}`);
  return value as T;
}

function assertPredicate(value: unknown): PredicateDefinition {
  ensure(isPlainObject(value), 'predicate must be an object');
  const type = ensureString(value.type, 'predicate.type');

  switch (type) {
    case 'metric_gt':
    case 'metric_lt':
      return {
        type,
        metric: ensureString(value.metric, 'predicate.metric'),
        value: ensureNumber(value.value, 'predicate.value'),
      };
    case 'event_count_since':
      return {
        type,
        event_type: ensureString(value.event_type, 'predicate.event_type'),
        since: ensureString(value.since, 'predicate.since'),
        min_count: ensureNumber(value.min_count, 'predicate.min_count'),
      };
    case 'lesson_confidence_gte':
      return {
        type,
        min_confidence: ensureNumber(value.min_confidence, 'predicate.min_confidence'),
        category:
          value.category === undefined ? undefined : ensureString(value.category, 'predicate.category'),
      };
    case 'file_matches_boundary':
      return {
        type,
        boundary: assertOneOf(value.boundary, ['growth_zone', 'forbidden_zone'], 'predicate.boundary'),
        paths: ensureStringArray(value.paths, 'predicate.paths'),
        match:
          value.match === undefined
            ? undefined
            : assertOneOf(value.match, BOUNDARY_MATCH_VALUES, 'predicate.match'),
      };
    case 'branch_is_clean':
      return {
        type,
        expected: ensureBoolean(value.expected, 'predicate.expected'),
      };
    case 'cooldown_inactive':
      return { type };
    case 'budget_available':
      return {
        type,
        minimum_remaining: ensureNumber(value.minimum_remaining, 'predicate.minimum_remaining'),
      };
    case 'integration_configured':
      return {
        type,
        integration: assertOneOf(
          value.integration,
          ['github', 'dashclaw', 'openclaw', 'anthropic'],
          'predicate.integration',
        ),
      };
    default:
      throw new Error(`predicate.type must be one of the supported predicates, received: ${type}`);
  }
}

function assertInputDefinition(value: unknown): InputDefinition {
  ensure(isPlainObject(value), 'input must be an object');
  return {
    name: ensureString(value.name, 'input.name'),
    source: assertOneOf(
      value.source,
      ['state_report', 'memory', 'config', 'runtime', 'constant'],
      'input.source',
    ),
    required: ensureBoolean(value.required, 'input.required'),
    path: value.path === undefined ? undefined : ensureString(value.path, 'input.path'),
    value: value.value,
  };
}

function assertConstraint(value: unknown): ConstraintDefinition {
  ensure(isPlainObject(value), 'constraint must be an object');
  const type = ensureString(value.type, 'constraint.type');

  switch (type) {
    case 'predicate':
      return {
        type,
        predicate: assertPredicate(value.predicate),
      };
    case 'allowed_write_root':
      return {
        type,
        root: ensureString(value.root, 'constraint.root'),
      };
    case 'requires_clean_branch':
      return { type };
    default:
      throw new Error(`constraint.type must be one of the supported constraints, received: ${type}`);
  }
}

function assertSuccessCriterion(value: unknown): SuccessCriterion {
  ensure(isPlainObject(value), 'success criterion must be an object');
  const type = ensureString(value.type, 'success_criteria.type');

  switch (type) {
    case 'artifact_written':
      return {
        type,
        path: ensureString(value.path, 'success_criteria.path'),
      };
    case 'predicate':
      return {
        type,
        predicate: assertPredicate(value.predicate),
      };
    case 'event_recorded':
      return {
        type,
        event_type: ensureString(value.event_type, 'success_criteria.event_type'),
      };
    default:
      throw new Error(`success_criteria.type must be supported, received: ${type}`);
  }
}

function assertLearningHook(value: unknown): LearningHook {
  ensure(isPlainObject(value), 'learning hook must be an object');
  const type = ensureString(value.type, 'learning_hooks.type');

  switch (type) {
    case 'record_event':
      return { type };
    case 'record_lesson':
      return {
        type,
        category:
          value.category === undefined ? undefined : ensureString(value.category, 'learning_hooks.category'),
      };
    case 'record_outcome':
      return { type };
    default:
      throw new Error(`learning_hooks.type must be supported, received: ${type}`);
  }
}

function assertRollbackDefinition(value: unknown): RollbackDefinition {
  ensure(isPlainObject(value), 'rollback_strategy must be an object');
  return {
    strategy: assertOneOf(
      value.strategy,
      ['none', 'delete_artifact', 'record_reversal'],
      'rollback_strategy.strategy',
    ),
    description: ensureString(value.description, 'rollback_strategy.description'),
  };
}

function assertActionStep(value: unknown): ActionStep {
  ensure(isPlainObject(value), 'step must be an object');
  const type = assertOneOf(value.type, ACTION_STEP_TYPES, 'step.type');
  const base = {
    id: ensureString(value.id, 'step.id'),
    title: ensureString(value.title, 'step.title'),
    type,
    description:
      value.description === undefined ? undefined : ensureString(value.description, 'step.description'),
    produces: value.produces === undefined ? undefined : ensureString(value.produces, 'step.produces'),
  };

  switch (type) {
    case 'read_repo_state':
      return {
        ...base,
        type,
        include: value.include === undefined ? undefined : ensureStringArray(value.include, 'step.include'),
      };
    case 'query_memory':
      return {
        ...base,
        type,
        query: ensureString(value.query, 'step.query'),
        top_k: value.top_k === undefined ? undefined : ensureNumber(value.top_k, 'step.top_k'),
      };
    case 'evaluate_predicate':
      return {
        ...base,
        type,
        predicate: assertPredicate(value.predicate),
      };
    case 'select_targets':
      return {
        ...base,
        type,
        source: ensureString(value.source, 'step.source'),
        limit: value.limit === undefined ? undefined : ensureNumber(value.limit, 'step.limit'),
      };
    case 'generate_artifact':
      return {
        ...base,
        type,
        format: assertOneOf(value.format, ['markdown', 'json', 'text'], 'step.format'),
        template: ensureString(value.template, 'step.template'),
      };
    case 'write_artifact':
      return {
        ...base,
        type,
        path: ensureString(value.path, 'step.path'),
        from: ensureString(value.from, 'step.from'),
      };
    case 'create_git_branch':
      return {
        ...base,
        type,
        name_template: ensureString(value.name_template, 'step.name_template'),
      };
    case 'run_safe_check':
      return {
        ...base,
        type,
        command: ensureString(value.command, 'step.command'),
        args: value.args === undefined ? undefined : ensureStringArray(value.args, 'step.args'),
      };
    case 'open_github_issue':
      return {
        ...base,
        type,
        title_template: ensureString(value.title_template, 'step.title_template'),
        body_from: ensureString(value.body_from, 'step.body_from'),
      };
    case 'record_event':
      return {
        ...base,
        type,
        event_type: ensureString(value.event_type, 'step.event_type'),
        summary: ensureString(value.summary, 'step.summary'),
        data_from: value.data_from === undefined ? undefined : ensureString(value.data_from, 'step.data_from'),
      };
    case 'record_lesson':
      return {
        ...base,
        type,
        category: ensureString(value.category, 'step.category'),
        lesson_from: ensureString(value.lesson_from, 'step.lesson_from'),
        confidence: ensureNumber(value.confidence, 'step.confidence'),
      };
  }
}

function assertStepExecutionResult(value: unknown): StepExecutionResult {
  ensure(isPlainObject(value), 'step result must be an object');
  return {
    step_id: ensureString(value.step_id, 'step_results.step_id'),
    step_type: assertOneOf(value.step_type, ACTION_STEP_TYPES, 'step_results.step_type'),
    status: assertOneOf(value.status, ['succeeded', 'failed', 'skipped'], 'step_results.status'),
    output: value.output,
    error: value.error === undefined ? undefined : ensureString(value.error, 'step_results.error'),
    started_at:
      value.started_at === undefined ? undefined : ensureString(value.started_at, 'step_results.started_at'),
    completed_at:
      value.completed_at === undefined
        ? undefined
        : ensureString(value.completed_at, 'step_results.completed_at'),
  };
}

export function assertActionTemplate(value: unknown): ActionTemplate {
  ensure(isPlainObject(value), 'action template must be an object');

  const risk = assertOneOf(value.risk, ACTION_RISKS, 'risk');
  const effects = ensureStringArray(value.effects, 'effects').map((effect) =>
    assertOneOf(effect, ACTION_EFFECTS, 'effect'),
  );

  const template: ActionTemplate = {
    id: ensureString(value.id, 'id'),
    name: ensureString(value.name, 'name'),
    version: ensureNumber(value.version, 'version'),
    status: assertOneOf(value.status, ACTION_TEMPLATE_STATUSES, 'status'),
    intent: ensureString(value.intent, 'intent'),
    description: ensureString(value.description, 'description'),
    triggers: Array.isArray(value.triggers)
      ? value.triggers.map((entry) => assertPredicate(entry))
      : (() => {
          throw new Error('triggers must be an array');
        })(),
    inputs: Array.isArray(value.inputs)
      ? value.inputs.map((entry) => assertInputDefinition(entry))
      : (() => {
          throw new Error('inputs must be an array');
        })(),
    constraints: Array.isArray(value.constraints)
      ? value.constraints.map((entry) => assertConstraint(entry))
      : (() => {
          throw new Error('constraints must be an array');
        })(),
    risk,
    effects,
    steps: Array.isArray(value.steps)
      ? value.steps.map((entry) => assertActionStep(entry))
      : (() => {
          throw new Error('steps must be an array');
        })(),
    success_criteria: Array.isArray(value.success_criteria)
      ? value.success_criteria.map((entry) => assertSuccessCriterion(entry))
      : (() => {
          throw new Error('success_criteria must be an array');
        })(),
    rollback_strategy:
      value.rollback_strategy === undefined ? undefined : assertRollbackDefinition(value.rollback_strategy),
    learning_hooks: Array.isArray(value.learning_hooks)
      ? value.learning_hooks.map((entry) => assertLearningHook(entry))
      : (() => {
          throw new Error('learning_hooks must be an array');
        })(),
    provenance: (() => {
      ensure(isPlainObject(value.provenance), 'provenance must be an object');
      return {
        source: assertOneOf(
          value.provenance.source,
          ['built_in', 'learned', 'human_authored'],
          'provenance.source',
        ),
        author:
          value.provenance.author === undefined
            ? undefined
            : ensureString(value.provenance.author, 'provenance.author'),
        created_at: ensureString(value.provenance.created_at, 'provenance.created_at'),
        updated_at: ensureString(value.provenance.updated_at, 'provenance.updated_at'),
      };
    })(),
  };

  if (
    template.risk === 'read_only' &&
    (template.effects.some((effect) => WRITE_EFFECTS.has(effect)) ||
      template.steps.some((step) => WRITE_STEP_TYPES.has(step.type)))
  ) {
    throw new Error('read_only templates cannot declare write effects or write-capable steps');
  }

  return template;
}

export function validateActionTemplate(value: unknown): { valid: boolean; errors: string[] } {
  try {
    assertActionTemplate(value);
    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function assertActionInstance(value: unknown): ActionInstance {
  ensure(isPlainObject(value), 'action instance must be an object');

  return {
    id: ensureString(value.id, 'id'),
    template_id: ensureString(value.template_id, 'template_id'),
    template_version: ensureNumber(value.template_version, 'template_version'),
    cycle: value.cycle === undefined ? undefined : ensureNumber(value.cycle, 'cycle'),
    status: assertOneOf(value.status, ACTION_INSTANCE_STATUSES, 'status'),
    bound_inputs: (() => {
      ensure(isPlainObject(value.bound_inputs), 'bound_inputs must be an object');
      return value.bound_inputs;
    })(),
    step_results: Array.isArray(value.step_results)
      ? value.step_results.map((entry) => assertStepExecutionResult(entry))
      : (() => {
          throw new Error('step_results must be an array');
        })(),
    started_at: value.started_at === undefined ? undefined : ensureString(value.started_at, 'started_at'),
    completed_at:
      value.completed_at === undefined ? undefined : ensureString(value.completed_at, 'completed_at'),
    failure_reason:
      value.failure_reason === undefined ? undefined : ensureString(value.failure_reason, 'failure_reason'),
  };
}
