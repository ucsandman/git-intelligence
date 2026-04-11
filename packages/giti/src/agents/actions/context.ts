import type { StateReport } from '../sensory-cortex/types.js';
import { loadKnowledgeBase } from '../memory/store.js';
import * as safety from '../orchestrator/safety.js';
import { loadOrganismConfig, runCommand } from '../utils.js';
import type { ActionPlanningContext } from './types.js';

function getIntegrationFlags(): Record<string, boolean> {
  return {
    github: Boolean(process.env['GITHUB_TOKEN'] || process.env['GH_TOKEN']),
    dashclaw: Boolean(process.env['DASHCLAW_URL'] && process.env['DASHCLAW_API_KEY']),
    openclaw: Boolean(process.env['OPENCLAW_API_KEY']),
    anthropic: Boolean(process.env['ANTHROPIC_API_KEY']),
  };
}

export async function loadActionPlanningContext(
  repoPath: string,
  stateReport: StateReport,
  options: Record<string, unknown> = {},
): Promise<ActionPlanningContext> {
  const [memory, config, inCooldown, apiUsage] = await Promise.all([
    loadKnowledgeBase(repoPath),
    loadOrganismConfig(repoPath),
    safety.isInCooldown(repoPath),
    safety.getApiUsage(repoPath),
  ]);

  const gitStatus = runCommand('git', ['status', '--porcelain'], repoPath);
  const branchClean = gitStatus.status === 0 && gitStatus.stdout.trim().length === 0;
  const apiBudgetRemaining = apiUsage ? Math.max(apiUsage.budget - apiUsage.monthly_tokens, 0) : Number.MAX_SAFE_INTEGER;

  return {
    repo_path: repoPath,
    state_report: stateReport as unknown as Record<string, unknown>,
    memory: memory as unknown as Record<string, unknown>,
    config: config as unknown as Record<string, unknown>,
    runtime: {
      ...options,
      branch_clean: branchClean,
      in_cooldown: inCooldown,
      api_budget_remaining: apiBudgetRemaining,
      integrations: getIntegrationFlags(),
    },
  };
}
