export interface ObservatorySnapshot {
  organism: {
    name: string;
    version: string;
    born: string;
    total_cycles: number;
    total_changes_merged: number;
    current_state: 'active' | 'idle' | 'cooldown' | 'killed';
  };
  vitals: {
    fitness_score: number;
    test_coverage: number;
    complexity_avg: number;
    dependency_health: number;
    commit_velocity_7d: number;
    mutation_success_rate: number;
    regression_rate: number;
  };
  current_cycle?: {
    number: number;
    phase: CyclePhase;
    started: string;
    events: OrganismEventDigest[];
  };
  history: CycleDigest[];
  dispatches: DispatchDigest[];
  milestones: string[];
  recent_events: OrganismEventDigest[];
  knowledge: {
    total_lessons: number;
    fragile_files: string[];
    rejection_reasons: Record<string, number>;
    successful_change_types: Record<string, number>;
    failed_change_types: Record<string, number>;
    preferences: string[];
  };
}

export type CyclePhase =
  | 'sense' | 'plan' | 'grow' | 'build' | 'defend' | 'commit' | 'reflect';

export type CycleOutcome =
  | 'productive' | 'stable' | 'no-changes' | 'regression' | 'human-declined' | 'aborted';

export interface CycleDigest {
  cycle: number;
  timestamp: string;
  outcome: CycleOutcome;
  changes_merged: number;
  changes_rejected: number;
  growth_proposals: number;
  api_tokens_used: number;
  duration_ms: number;
  milestone?: string;
}

export interface OrganismEventDigest {
  id: string;
  timestamp: string;
  cycle: number;
  type: string;
  agent: string;
  summary: string;
}

export interface DispatchDigest {
  cycle: number;
  timestamp: string;
  headline: string;
  narrative: string;
  key_moments: Array<{ moment: string; significance: string }>;
  stats: {
    changes_merged: number;
    changes_rejected: number;
    growth_proposals: number;
    fitness_delta: number;
    streak: number;
  };
  milestone?: string;
}
