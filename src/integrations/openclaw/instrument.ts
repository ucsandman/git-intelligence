import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentTrace } from './types.js';

export async function traceAgent<T>(
  agent: string,
  action: string,
  cycle: number,
  inputs: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const apiKey = process.env['OPENCLAW_API_KEY'];
  const startedAt = new Date().toISOString();
  const start = Date.now();

  try {
    const result = await fn();
    const trace: AgentTrace = {
      agent, action, cycle,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      status: 'success',
      inputs,
      outputs: summarizeOutput(result),
      metadata: {},
    };
    await persistTrace(trace, apiKey);
    return result;
  } catch (error) {
    const trace: AgentTrace = {
      agent, action, cycle,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      status: 'failure',
      inputs,
      outputs: { error: String(error) },
      metadata: {},
    };
    await persistTrace(trace, apiKey).catch(() => {}); // Never let tracing block errors
    throw error;
  }
}

function summarizeOutput(result: unknown): Record<string, unknown> {
  if (result === null || result === undefined) return {};
  if (typeof result !== 'object') return { value: String(result) };
  // Return a shallow summary to avoid massive serializations
  const obj = result as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const key of Object.keys(obj).slice(0, 10)) {
    const val = obj[key];
    summary[key] = typeof val === 'object' ? `[${typeof val}]` : val;
  }
  return summary;
}

async function persistTrace(trace: AgentTrace, apiKey: string | undefined): Promise<void> {
  if (apiKey) {
    // Future: POST to OpenClaw endpoint
    // For now, fall through to local file
  }

  // Write to local .organism/traces/
  const tracesDir = path.join(process.cwd(), '.organism', 'traces');
  await fs.mkdir(tracesDir, { recursive: true });
  const safeTimestamp = trace.started_at.replace(/:/g, '-');
  const filename = `${trace.agent}-${safeTimestamp}.json`;
  await fs.writeFile(path.join(tracesDir, filename), JSON.stringify(trace, null, 2));
}
