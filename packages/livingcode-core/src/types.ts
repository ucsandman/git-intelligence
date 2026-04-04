export interface OrganismConfig {
  identity: {
    name: string;
    purpose: string;
    philosophy?: string;
  };
  boundaries: {
    growth_zone: string[];
    forbidden_zone: string[];
  };
  quality_standards: {
    test_coverage_floor: number;
    max_complexity_per_function: number;
    max_file_length: number;
    zero_tolerance: string[];
    performance_budget: Record<string, string>;
  };
  evolutionary_principles: string[];
  lifecycle: {
    cycle_frequency: string;
    max_changes_per_cycle: number;
    mandatory_cooldown_after_regression: string;
    branch_naming: string;
    requires_immune_approval: boolean;
  };
}

export interface LivingCodebaseConfig {
  manifestPath: string;
  workingDir: string;
  motorCortex?: {
    model?: string;
    maxTokensPerItem?: number;
    maxRetriesPerItem?: number;
  };
  integrations?: {
    dashclaw?: { apiKey?: string; endpoint?: string };
    github?: { token?: string; owner?: string; repo?: string };
    openclaw?: { apiKey?: string };
  };
  schedule?: string;
}
