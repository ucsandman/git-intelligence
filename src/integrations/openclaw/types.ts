export interface AgentTrace {
  agent: string;
  action: string;
  cycle: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: 'success' | 'failure';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
