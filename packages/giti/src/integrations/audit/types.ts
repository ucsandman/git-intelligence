export interface AuditEntry {
  timestamp: string;
  agent: string;
  action: string;
  target: string;
  outcome: 'success' | 'failure' | 'skipped';
  reasoning?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}
