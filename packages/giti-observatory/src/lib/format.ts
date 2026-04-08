const LABEL_MAP: Record<string, string> = {
  fitness_score: 'Health',
  test_coverage: 'Test Coverage',
  mutation_success_rate: 'Success Rate',
  regression_rate: 'Regression Rate',
  commit_velocity_7d: 'Weekly Activity',
  dependency_health: 'Dependency Health',
  complexity_avg: 'Complexity',
};

export function friendlyLabel(key: string): string {
  return LABEL_MAP[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const OUTCOME_MAP: Record<string, string> = {
  productive: 'Productive',
  stable: 'Stable',
  'no-changes': 'No Changes',
  regression: 'Regression',
  'human-declined': 'Human Declined',
  aborted: 'Aborted',
};

export function friendlyOutcome(outcome: string): string {
  return OUTCOME_MAP[outcome] ?? outcome;
}

export function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
