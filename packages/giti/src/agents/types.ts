export type AgentRole =
  | 'sensory-cortex'
  | 'immune-system'
  | 'memory'
  | 'prefrontal-cortex'
  | 'motor-cortex'
  | 'growth-hormone';

export interface AgentOutput<T> {
  agent: AgentRole;
  timestamp: string;
  cycle?: number;
  data: T;
}

export interface OrganismEvent {
  id: string;
  timestamp: string;
  cycle: number;
  type: EventType;
  agent: AgentRole;
  summary: string;
  data: Record<string, unknown>;
  tags: string[];
}

export type EventType =
  | 'change-merged'
  | 'change-rejected'
  | 'regression-detected'
  | 'regression-fixed'
  | 'growth-proposed'
  | 'growth-approved'
  | 'growth-rejected'
  | 'baseline-updated'
  | 'anomaly-detected'
  | 'cycle-started'
  | 'plan-created'
  | 'implementation-complete'
  | 'implementation-failed'
  | 'change-approved'
  | 'merge-failed'
  | 'merge-declined-by-human'
  | 'cycle-complete';

export interface FieldTarget {
  slug: string;
  path: string;
  enabled: boolean;
}

export interface NarratorConfig {
  enabled: boolean;
  model: string;
  max_tokens: number;
  cache_system_prompt: boolean;
  /** Optional project-specific context appended to the narrator's system prompt. */
  context?: string;
}

export interface OrganismConfig {
  quality_standards: {
    test_coverage_floor: number;
    max_complexity_per_function: number;
    max_file_length: number;
    zero_tolerance: string[];
    performance_budget: Record<string, string>;
  };
  boundaries: {
    growth_zone: string[];
    forbidden_zone: string[];
  };
  lifecycle: {
    cycle_frequency: string;
    max_changes_per_cycle: number;
    mandatory_cooldown_after_regression: string;
    branch_naming: string;
    requires_immune_approval: boolean;
  };
  field_targets?: FieldTarget[];
  narrator?: NarratorConfig;
}
