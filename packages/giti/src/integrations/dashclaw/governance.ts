/**
 * DashClaw Governance Integration
 *
 * Routes organism decisions through DashClaw's guard → approval → action lifecycle.
 * Provides human-in-the-loop approval for code changes before merge.
 */

interface GuardRequest {
  action_type: string;
  risk_score: number;
  agent_id: string;
  systems_touched: string[];
  reversible: boolean;
  declared_goal: string;
}

interface GuardResponse {
  decision: 'allow' | 'block' | 'require_approval' | 'degrade';
  action_id: string;
  reason: string;
  signals: string[];
  matched_policies: string[];
}

interface ActionRecord {
  action_id: string;
  status: string;
  action_type: string;
  declared_goal: string;
}

interface ActionOutcome {
  status: 'completed' | 'failed';
  result_summary: string;
  side_effects?: string[];
}

export interface GovernanceDecision {
  allowed: boolean;
  actionId: string;
  reason: string;
  requiresApproval: boolean;
}

function getDashClawConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env['DASHCLAW_URL'] ?? process.env['DASHCLAW_BASE_URL'];
  const apiKey = process.env['DASHCLAW_API_KEY'];
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

async function dashClawFetch<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T | null> {
  const config = getDashClawConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      console.log(`[dashclaw] ${method} ${path} failed: ${res.status} ${res.statusText}`);
      return null;
    }

    return await res.json() as T;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[dashclaw] ${method} ${path} error: ${msg}`);
    return null;
  }
}

/**
 * Check if DashClaw governance is configured
 */
export function isGovernanceEnabled(): boolean {
  return getDashClawConfig() !== null;
}

/**
 * Submit a code change for governance review.
 * Returns whether the change is allowed, blocked, or needs human approval.
 */
export async function guardCodeChange(params: {
  workItemTitle: string;
  branchName: string;
  filesChanged: string[];
  testsPass: boolean;
  cycleNumber: number;
}): Promise<GovernanceDecision> {
  const config = getDashClawConfig();
  if (!config) {
    // No DashClaw configured — allow by default
    return { allowed: true, actionId: '', reason: 'DashClaw not configured', requiresApproval: false };
  }

  console.log(`[dashclaw] Submitting guard check for: ${params.workItemTitle}`);

  // Calculate risk score based on change characteristics
  const fileCount = params.filesChanged.length;
  const riskScore = Math.min(100, fileCount * 15 + (params.testsPass ? 0 : 40));

  const guardResult = await dashClawFetch<GuardResponse>('/api/guard', 'POST', {
    action_type: 'code_change',
    risk_score: riskScore,
    agent_id: 'giti-organism',
    systems_touched: params.filesChanged.slice(0, 10),
    reversible: true,
    declared_goal: `Merge "${params.workItemTitle}" (cycle ${params.cycleNumber}, ${fileCount} files, tests ${params.testsPass ? 'passing' : 'failing'})`,
  } satisfies GuardRequest);

  if (!guardResult) {
    console.log('[dashclaw] Guard check failed — allowing by default');
    return { allowed: true, actionId: '', reason: 'Guard unreachable', requiresApproval: false };
  }

  console.log(`[dashclaw] Guard decision: ${guardResult.decision} — ${guardResult.reason}`);

  if (guardResult.decision === 'block') {
    return {
      allowed: false,
      actionId: guardResult.action_id,
      reason: guardResult.reason,
      requiresApproval: false,
    };
  }

  if (guardResult.decision === 'require_approval') {
    return {
      allowed: false,
      actionId: guardResult.action_id,
      reason: guardResult.reason,
      requiresApproval: true,
    };
  }

  // 'allow' or 'degrade'
  return {
    allowed: true,
    actionId: guardResult.action_id,
    reason: guardResult.reason,
    requiresApproval: false,
  };
}

/**
 * Wait for human approval on a DashClaw action.
 * Polls the action status until approved, denied, or timeout.
 */
export async function waitForApproval(
  actionId: string,
  timeoutMs: number = 300_000, // 5 minutes default
): Promise<{ approved: boolean; reason?: string }> {
  console.log(`[dashclaw] Waiting for human approval on action ${actionId}...`);
  console.log(`[dashclaw] Approve at: ${getDashClawConfig()?.baseUrl}/replay/${actionId}`);

  const startTime = Date.now();
  const pollInterval = 5_000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    const action = await dashClawFetch<ActionRecord>(`/api/actions/${actionId}`, 'GET');
    if (!action) {
      await sleep(pollInterval);
      continue;
    }

    if (action.status === 'running' || action.status === 'completed') {
      console.log('[dashclaw] Action approved!');
      return { approved: true };
    }

    if (action.status === 'blocked' || action.status === 'failed') {
      console.log(`[dashclaw] Action denied: ${action.status}`);
      return { approved: false, reason: action.status };
    }

    // Still pending — keep polling
    await sleep(pollInterval);
  }

  console.log('[dashclaw] Approval timeout — denying by default');
  return { approved: false, reason: 'Approval timeout' };
}

/**
 * Record the outcome of a code change action in DashClaw.
 */
export async function recordOutcome(
  actionId: string,
  outcome: ActionOutcome,
): Promise<void> {
  if (!actionId || !getDashClawConfig()) return;

  await dashClawFetch(`/api/actions/${actionId}`, 'PATCH', {
    status: outcome.status,
    outcome: {
      result_summary: outcome.result_summary,
      side_effects: outcome.side_effects ?? [],
    },
  });

  console.log(`[dashclaw] Recorded outcome: ${outcome.status} — ${outcome.result_summary}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
