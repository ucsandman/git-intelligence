export interface TelemetryEvent {
  event_id: string;
  timestamp: string;
  giti_version: string;
  node_version: string;
  os_platform: string;
  command: string;
  flags_used: string[];
  execution_time_ms: number;
  exit_code: number;
  error_type?: string;
  repo_characteristics: RepoCharacteristics;
}

export interface RepoCharacteristics {
  commit_count_bucket: string;
  branch_count_bucket: string;
  author_count_bucket: string;
  primary_language: string;
  has_monorepo_structure: boolean;
  age_bucket: string;
}

export interface TelemetryConfig {
  enabled: boolean;
  first_prompt_shown: boolean;
}
