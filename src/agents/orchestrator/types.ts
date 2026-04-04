export interface CycleOptions {
  supervised: boolean;
  repoPath: string;
}

export interface CycleResult {
  cycle: number;
  outcome: 'productive' | 'stable' | 'no-changes' | 'regression' | 'human-declined' | 'aborted';
  changes_merged: number;
  changes_attempted: number;
  changes_approved: number;
  changes_rejected: number;
  duration_ms: number;
  api_tokens_used: number;
  regressions: string[];
}

export interface OrganismStatus {
  state: 'running' | 'stopped' | 'cooldown' | 'paused';
  last_cycle: CycleResult | null;
  next_cycle_at: string | null;
  total_cycles: number;
  total_changes_merged: number;
  total_changes_rejected: number;
  total_api_tokens: number;
  api_budget: number;
  cooldown_until: string | null;
  consecutive_failures: number;
}

export interface SchedulerConfig {
  pid: number;
  interval_ms: number;
  started_at: string;
  repo_path: string;
}
