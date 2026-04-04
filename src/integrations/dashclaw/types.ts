export interface VitalSigns {
  fitness_score: number;
  test_coverage: number;
  lint_errors: number;
  complexity_avg: number;
  performance: Record<string, number>;
  dependency_health: number;
  commit_velocity_7d: number;
  mutation_success_rate: number;
  regression_rate: number;
}

export interface CycleSummary {
  outcome: string;
  items_planned: number;
  items_implemented: number;
  items_approved: number;
  items_merged: number;
  growth_proposals: number;
  api_tokens_used: number;
}

export interface DecisionEntry {
  agent: string;
  action: string;
  reasoning: string;
  outcome: string;
}

export interface EvolutionaryState {
  total_commands: number;
  commands_list: string[];
  total_files: number;
  total_lines: number;
  organism_born: string;
  total_cycles: number;
  total_changes_merged: number;
  total_changes_rejected: number;
  growth_features_shipped: number;
  current_cooldown: boolean;
  emerged_preferences: string[];
  top_lessons: string[];
}

export interface DashClawCycleReport {
  cycle_number: number;
  timestamp: string;
  organism_version: string;
  vital_signs: VitalSigns;
  cycle_summary: CycleSummary;
  decisions: DecisionEntry[];
  evolutionary_state: EvolutionaryState;
}

export interface DashClawConfig {
  api_key?: string;
  endpoint?: string;
  dashboard_id?: string;
}
