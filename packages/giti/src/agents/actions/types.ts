export type ActionTemplateStatus = 'active' | 'deprecated' | 'disabled';

export type ActionRisk = 'read_only' | 'low' | 'medium' | 'high';

export type ActionEffect =
  | 'writes_files'
  | 'creates_branch'
  | 'opens_issue'
  | 'records_memory'
  | 'calls_external_api';

export type ActionStepType =
  | 'read_repo_state'
  | 'query_memory'
  | 'evaluate_predicate'
  | 'select_targets'
  | 'generate_artifact'
  | 'write_artifact'
  | 'create_git_branch'
  | 'run_safe_check'
  | 'open_github_issue'
  | 'record_event'
  | 'record_lesson';

export type ActionInstanceStatus =
  | 'planned'
  | 'approved'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'rejected';

export type PredicateDefinition =
  | {
      type: 'metric_gt';
      metric: string;
      value: number;
    }
  | {
      type: 'metric_lt';
      metric: string;
      value: number;
    }
  | {
      type: 'event_count_since';
      event_type: string;
      since: string;
      min_count: number;
    }
  | {
      type: 'lesson_confidence_gte';
      min_confidence: number;
      category?: string;
    }
  | {
      type: 'file_matches_boundary';
      boundary: 'growth_zone' | 'forbidden_zone';
      paths: string[];
      match?: 'any' | 'all';
    }
  | {
      type: 'branch_is_clean';
      expected: boolean;
    }
  | {
      type: 'cooldown_inactive';
    }
  | {
      type: 'budget_available';
      minimum_remaining: number;
    }
  | {
      type: 'integration_configured';
      integration: 'github' | 'dashclaw' | 'openclaw' | 'anthropic';
    };

export interface InputDefinition {
  name: string;
  source: 'state_report' | 'memory' | 'config' | 'runtime' | 'constant';
  required: boolean;
  path?: string;
  value?: unknown;
}

export type ConstraintDefinition =
  | {
      type: 'predicate';
      predicate: PredicateDefinition;
    }
  | {
      type: 'allowed_write_root';
      root: string;
    }
  | {
      type: 'requires_clean_branch';
    };

export type SuccessCriterion =
  | {
      type: 'artifact_written';
      path: string;
    }
  | {
      type: 'predicate';
      predicate: PredicateDefinition;
    }
  | {
      type: 'event_recorded';
      event_type: string;
    };

export type LearningHook =
  | {
      type: 'record_event';
    }
  | {
      type: 'record_lesson';
      category?: string;
    }
  | {
      type: 'record_outcome';
    };

export interface RollbackDefinition {
  strategy: 'none' | 'delete_artifact' | 'record_reversal';
  description: string;
}

interface BaseActionStep {
  id: string;
  title: string;
  type: ActionStepType;
  description?: string;
  produces?: string;
}

export interface ReadRepoStateStep extends BaseActionStep {
  type: 'read_repo_state';
  include?: string[];
}

export interface QueryMemoryStep extends BaseActionStep {
  type: 'query_memory';
  query: string;
  top_k?: number;
}

export interface EvaluatePredicateStep extends BaseActionStep {
  type: 'evaluate_predicate';
  predicate: PredicateDefinition;
}

export interface SelectTargetsStep extends BaseActionStep {
  type: 'select_targets';
  source: string;
  limit?: number;
}

export interface GenerateArtifactStep extends BaseActionStep {
  type: 'generate_artifact';
  format: 'markdown' | 'json' | 'text';
  template: string;
}

export interface WriteArtifactStep extends BaseActionStep {
  type: 'write_artifact';
  path: string;
  from: string;
}

export interface CreateGitBranchStep extends BaseActionStep {
  type: 'create_git_branch';
  name_template: string;
}

export interface RunSafeCheckStep extends BaseActionStep {
  type: 'run_safe_check';
  command: string;
  args?: string[];
}

export interface OpenGitHubIssueStep extends BaseActionStep {
  type: 'open_github_issue';
  title_template: string;
  body_from: string;
}

export interface RecordEventStep extends BaseActionStep {
  type: 'record_event';
  event_type: string;
  summary: string;
  data_from?: string;
}

export interface RecordLessonStep extends BaseActionStep {
  type: 'record_lesson';
  category: string;
  lesson_from: string;
  confidence: number;
}

export type ActionStep =
  | ReadRepoStateStep
  | QueryMemoryStep
  | EvaluatePredicateStep
  | SelectTargetsStep
  | GenerateArtifactStep
  | WriteArtifactStep
  | CreateGitBranchStep
  | RunSafeCheckStep
  | OpenGitHubIssueStep
  | RecordEventStep
  | RecordLessonStep;

export interface ActionTemplate {
  id: string;
  name: string;
  version: number;
  status: ActionTemplateStatus;
  intent: string;
  description: string;
  triggers: PredicateDefinition[];
  inputs: InputDefinition[];
  constraints: ConstraintDefinition[];
  risk: ActionRisk;
  effects: ActionEffect[];
  steps: ActionStep[];
  success_criteria: SuccessCriterion[];
  rollback_strategy?: RollbackDefinition;
  learning_hooks: LearningHook[];
  provenance: {
    source: 'built_in' | 'learned' | 'human_authored';
    author?: string;
    created_at: string;
    updated_at: string;
  };
}

export interface StepExecutionResult {
  step_id: string;
  step_type: ActionStepType;
  status: 'succeeded' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ActionInstance {
  id: string;
  template_id: string;
  template_version: number;
  cycle?: number;
  status: ActionInstanceStatus;
  bound_inputs: Record<string, unknown>;
  step_results: StepExecutionResult[];
  started_at?: string;
  completed_at?: string;
  failure_reason?: string;
}

export interface ActionPlanningContext {
  repo_path: string;
  state_report?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  config?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
}

export interface ActionRecommendation {
  template_id: string;
  template_version: number;
  score: number;
  rationale: string[];
  risk: ActionRisk;
}
