export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: Record<string, unknown>;
}

export interface ReviewRisk {
  description: string;
  severity: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface ReviewVerdict {
  branch: string;
  timestamp: string;
  verdict: 'approve' | 'reject' | 'request-changes';
  confidence: number;
  summary: string;
  checks: CheckResult[];
  risks: ReviewRisk[];
  recommendation: string;
}

export interface Baselines {
  last_updated: string;
  test_coverage: number;
  test_count: number;
  lint_errors: number;
  performance: {
    pulse_ms: number;
    hotspots_ms: number;
    ghosts_ms: number;
  };
  complexity: {
    total: number;
    avg_per_file: number;
  };
  dependency_count: number;
  file_count: number;
  total_lines: number;
}

export interface FragileFileInfo {
  path: string;
  regression_count: number;
  last_regression: string;
  notes: string;
}

export interface RegressionContext {
  fragile_files: FragileFileInfo[];
}

export interface ActionPolicyReason {
  code: 'kill-switch' | 'cooldown' | 'write-root' | 'effect-mismatch' | 'read-only';
  message: string;
}

export interface ActionPolicyVerdict {
  allowed: boolean;
  reasons: ActionPolicyReason[];
}
