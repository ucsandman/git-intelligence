export interface StateReport {
  timestamp: string;
  version: string;

  git: {
    total_commits: number;
    commits_last_7d: number;
    commits_last_30d: number;
    unique_authors_30d: number;
    active_branches: number;
    stale_branches: number;
    last_commit_age_hours: number;
    avg_commit_size_lines: number;
  };

  quality: {
    test_file_count: number;
    source_file_count: number;
    test_ratio: number;
    test_pass_rate: number;
    test_coverage_percent: number;
    lint_error_count: number;
    files_exceeding_length_limit: string[];
    functions_exceeding_complexity: string[];
  };

  performance: {
    pulse_execution_ms: number;
    hotspots_execution_ms: number;
    ghosts_execution_ms: number;
    benchmarked_against: string;
  };

  dependencies: {
    total_count: number;
    outdated_count: number;
    vulnerable_count: number;
    outdated_packages: OutdatedPackage[];
    vulnerabilities: Vulnerability[];
  };

  codebase: {
    total_files: number;
    total_lines: number;
    avg_file_length: number;
    largest_files: Array<{ path: string; lines: number }>;
    file_type_distribution: Record<string, number>;
  };

  anomalies: Anomaly[];
  growth_signals: GrowthSignal[];
}

export interface OutdatedPackage {
  name: string;
  current: string;
  latest: string;
  severity: 'patch' | 'minor' | 'major';
}

export interface Vulnerability {
  package: string;
  severity: string;
  description: string;
}

export interface Anomaly {
  type: 'quality_floor_approaching' | 'performance_regression' | 'dependency_vulnerability' | 'complexity_spike';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: Record<string, unknown>;
}

export interface GrowthSignal {
  signal: string;
  evidence: string;
  confidence: number;
}

export interface TrendResult {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change_percent: number;
  period_cycles: number;
}
