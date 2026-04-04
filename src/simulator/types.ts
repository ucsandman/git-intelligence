export type RepoType = 'small' | 'medium' | 'large' | 'monorepo' | 'ancient' | 'fresh';

export interface SimulationConfig {
  scenario_count: number;
  repo_types: RepoType[];
}

export interface ScenarioResult {
  repo_type: RepoType;
  scenario: string;
  commands_run: string[];
  events_generated: number;
  duration_ms: number;
}

export interface SimulationResult {
  timestamp: string;
  total_scenarios: number;
  total_events: number;
  results: ScenarioResult[];
  duration_ms: number;
}
