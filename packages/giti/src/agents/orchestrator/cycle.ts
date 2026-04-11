import fs from 'node:fs/promises';
import path from 'node:path';
import type { CycleOptions, CycleResult } from './types.js';
import type { StateReport } from '../sensory-cortex/types.js';
import type { CyclePlan, WorkItem } from '../prefrontal-cortex/types.js';
import type { ReviewVerdict } from '../immune-system/types.js';
import * as safety from './safety.js';
import { runSensoryCortex } from '../sensory-cortex/index.js';
import { runPrefrontalCortex } from '../prefrontal-cortex/index.js';
import { runMotorCortex } from '../motor-cortex/index.js';
import { runImmuneReview } from '../immune-system/index.js';
import { createBaselinesFromReport, writeBaselines } from '../immune-system/baselines.js';
import { recordMemoryEvent } from '../memory/index.js';
import { mergeBranch, deleteBranch, switchToMain, pushBranch } from '../motor-cortex/branch-manager.js';
import { runGrowthHormone } from '../growth-hormone/index.js';
import {
  buildActionInstance,
  getActionTemplate,
  loadActionPlanningContext,
  runActionInstance,
} from '../actions/index.js';
import { createGitHubClient } from '../../integrations/github/client.js';
import { formatPRBody, formatPRTitle, getPRLabels } from '../../integrations/github/pr-formatter.js';
import { isGovernanceEnabled, guardCodeChange, waitForApproval, recordOutcome } from '../../integrations/dashclaw/governance.js';

export async function runLifecycleCycle(options: CycleOptions): Promise<CycleResult> {
  const { repoPath, supervised } = options;
  const startTime = Date.now();
  let totalTokens = 0;

  // Pre-flight safety checks
  if (await safety.isKillSwitchActive(repoPath)) {
    return makeResult(0, startTime, 'aborted', 'Kill switch active');
  }
  if (await safety.getConsecutiveFailures(repoPath) >= 3) {
    return makeResult(0, startTime, 'aborted', '3+ consecutive failures');
  }

  // Acquire lock (increments cycle counter)
  let cycle: number;
  try {
    cycle = await safety.acquireCycleLock(repoPath);
  } catch (error) {
    return makeResult(0, startTime, 'aborted', String(error));
  }

  try {
    // Phase 1: SENSE
    if (await safety.isKillSwitchActive(repoPath)) return makeResult(cycle, startTime, 'aborted');
    const { report } = await runSensoryCortex(repoPath);
    await recordMemoryEvent(repoPath, 'cycle-started', `Cycle ${cycle} started`, { cycle });

    // Phase 2: PLAN
    if (await safety.isKillSwitchActive(repoPath)) return makeResult(cycle, startTime, 'aborted');
    const plan = await runPrefrontalCortex(repoPath, report);
    await recordMemoryEvent(repoPath, 'plan-created', `Planned ${plan.selected_items.length} items`, { cycle, items: plan.selected_items.length });

    // If planner selected nothing, check backlog for manually-seeded planned items
    if (plan.selected_items.length === 0) {
      const backlogDir = path.join(repoPath, '.organism', 'backlog');
      try {
        const files = await fs.readdir(backlogDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const raw = await fs.readFile(path.join(backlogDir, file), 'utf-8');
          const item = JSON.parse(raw) as WorkItem;
          if (item.status === 'planned') {
            plan.selected_items.push(item);
          }
        }
      } catch {
        // No backlog dir or read error — that's fine
      }
    }

    await runRecommendedAction(repoPath, cycle, report, plan);

    if (plan.selected_items.length === 0) {
      await recordMemoryEvent(repoPath, 'cycle-complete', `Cycle ${cycle} stable`, { cycle, outcome: 'stable' });
      return makeResult(cycle, startTime, 'stable');
    }

    // Phase 2.5: GROW
    if (await safety.isKillSwitchActive(repoPath)) return makeResult(cycle, startTime, 'aborted');
    try {
      const { proposals } = await runGrowthHormone(repoPath);
      if (proposals.length > 0) {
        await recordMemoryEvent(repoPath, 'growth-proposed', `${proposals.length} growth proposals generated`, {
          cycle, proposals: proposals.map(p => p.title),
        });
      }
    } catch {
      // Growth analysis failure is non-critical — continue with cycle
    }

    // Phase 3: BUILD
    const buildResults: Array<import('../motor-cortex/types.js').ImplementationResult> = [];
    const branchToWorkItem = new Map<string, WorkItem>();
    for (const item of plan.selected_items) {
      if (await safety.isKillSwitchActive(repoPath)) break;
      if (!await safety.checkApiBudget(repoPath)) break;
      try {
        const result = await runMotorCortex(repoPath, item, cycle);
        buildResults.push(result);
        branchToWorkItem.set(result.branch_name, item);
        totalTokens += result.claude_tokens_used;
        await safety.recordApiUsage(repoPath, result.claude_tokens_used);
        await recordMemoryEvent(repoPath, 'implementation-complete', `Built: ${item.title}`, { cycle, branch: result.branch_name });
      } catch (error) {
        await recordMemoryEvent(repoPath, 'implementation-failed', `Build failed: ${item.title}`, { cycle, error: String(error) });
      }
    }

    // Phase 4: DEFEND
    const approvedBranches: string[] = [];
    const branchToVerdict = new Map<string, ReviewVerdict>();
    let rejectedCount = 0;
    for (const result of buildResults.filter(r => r.status === 'success')) {
      try {
        const { verdict } = await runImmuneReview(repoPath, result.branch_name);
        if (verdict.verdict === 'approve') {
          approvedBranches.push(result.branch_name);
          branchToVerdict.set(result.branch_name, verdict);
          await recordMemoryEvent(repoPath, 'change-approved', `Approved: ${result.branch_name}`, { cycle, branch: result.branch_name });
        } else {
          rejectedCount++;
          await recordMemoryEvent(repoPath, 'change-rejected', `Rejected: ${result.branch_name}`, { cycle, branch: result.branch_name, verdict: verdict.verdict });
        }
      } catch (error) {
        rejectedCount++;
        await recordMemoryEvent(repoPath, 'change-rejected', `Review error: ${result.branch_name}`, { cycle, error: String(error) });
      }
    }

    // Phase 4.5: DASHCLAW GOVERNANCE (if configured)
    const governedBranches: string[] = [];
    if (isGovernanceEnabled() && governedBranches.length > 0) {
      for (const branch of governedBranches) {
        const workItem = branchToWorkItem.get(branch) ?? plan.selected_items[0]!;
        const buildResult = buildResults.find((r) => r.branch_name === branch);
        const decision = await guardCodeChange({
          workItemTitle: workItem.title,
          branchName: branch,
          filesChanged: buildResult?.files_modified ?? [],
          testsPass: buildResult?.pre_review_check.tests_pass ?? false,
          cycleNumber: cycle,
        });

        if (decision.allowed) {
          governedBranches.push(branch);
          await recordMemoryEvent(repoPath, 'change-approved', `DashClaw approved: ${branch}`, { cycle, branch, actionId: decision.actionId });
        } else if (decision.requiresApproval) {
          console.log(`[cycle] DashClaw requires human approval for: ${branch}`);
          const approval = await waitForApproval(decision.actionId, 300_000);
          if (approval.approved) {
            governedBranches.push(branch);
            await recordMemoryEvent(repoPath, 'change-approved', `Human approved via DashClaw: ${branch}`, { cycle, branch, actionId: decision.actionId });
          } else {
            await recordMemoryEvent(repoPath, 'merge-declined-by-human', `Human denied via DashClaw: ${branch} — ${approval.reason}`, { cycle, branch, actionId: decision.actionId });
            await recordOutcome(decision.actionId, { status: 'failed', result_summary: `Denied: ${approval.reason}` });
          }
        } else {
          await recordMemoryEvent(repoPath, 'change-rejected', `DashClaw blocked: ${branch} — ${decision.reason}`, { cycle, branch, actionId: decision.actionId });
          await recordOutcome(decision.actionId, { status: 'failed', result_summary: `Blocked: ${decision.reason}` });
        }
      }
    } else {
      // No DashClaw — all immune-approved branches proceed
      governedBranches.push(...approvedBranches);
    }

    // Phase 5: COMMIT
    let mergedCount = 0;
    const githubClient = createGitHubClient();

    if (githubClient && governedBranches.length > 0) {
      // GitHub PR workflow
      const autoMerge = process.env['GITI_AUTO_MERGE'] === 'true';
      const autoMergeDelay = Math.min(parseInt(process.env['GITI_AUTO_MERGE_DELAY'] ?? '3600000', 10), 10000);
      for (const branch of governedBranches) {
        try {
          await pushBranch(repoPath, branch);
          const workItem = branchToWorkItem.get(branch) ?? plan.selected_items[0]!;
          const verdict = branchToVerdict.get(branch)!;
          const prBody = formatPRBody({ workItem, cycleNumber: cycle, verdict, stateReport: report });
          const pr = await githubClient.createPullRequest({
            branch,
            title: formatPRTitle(workItem, cycle),
            body: prBody,
            labels: getPRLabels(workItem),
          });
          if (!supervised && autoMerge) {
            await new Promise(resolve => setTimeout(resolve, autoMergeDelay));
            await githubClient.mergePullRequest(pr.number, 'squash');
            mergedCount++;
          }
          await recordMemoryEvent(repoPath, 'change-merged', `PR created: ${branch} (#${pr.number})`, { cycle, branch, pr: pr.number, url: pr.url });
        } catch (error) {
          await recordMemoryEvent(repoPath, 'merge-failed', `GitHub PR failed: ${branch}`, { cycle, branch, error: String(error) });
        }
      }
    } else if (!supervised && governedBranches.length > 0) {
      // Local merge workflow (fallback when GitHub is not configured)
      for (const branch of governedBranches) {
        try {
          await switchToMain(repoPath);
          await mergeBranch(repoPath, branch);
          await deleteBranch(repoPath, branch);
          mergedCount++;
          await recordMemoryEvent(repoPath, 'change-merged', `Merged: ${branch}`, { cycle, branch });
        } catch (error) {
          await recordMemoryEvent(repoPath, 'merge-failed', `Merge failed: ${branch}`, { cycle, branch, error: String(error) });
        }
      }
    } else if (supervised && governedBranches.length > 0) {
      // In supervised mode, don't merge. Return for human confirmation.
      // Branches are left in place for manual merge.
      await recordMemoryEvent(repoPath, 'cycle-complete', `Cycle ${cycle} supervised — ${approvedBranches.length} branches await human merge`, { cycle, supervised: true, branches: approvedBranches });
      return {
        cycle,
        outcome: 'human-declined',
        changes_merged: 0,
        changes_attempted: buildResults.length,
        changes_approved: approvedBranches.length,
        changes_rejected: rejectedCount,
        duration_ms: Date.now() - startTime,
        api_tokens_used: totalTokens,
        regressions: [],
      };
    }

    // Phase 6: REFLECT
    let regressions: string[] = [];
    if (mergedCount > 0) {
      const { report: postReport } = await runSensoryCortex(repoPath);
      const baselines = createBaselinesFromReport(postReport);
      await writeBaselines(repoPath, baselines);

      const regression = detectRegression(report, postReport);
      if (regression) {
        regressions = [regression];
        await recordMemoryEvent(repoPath, 'regression-detected', regression, { cycle });
        await safety.setCooldown(repoPath, 48 * 60 * 60 * 1000);
      }
    }

    // Track consecutive failures
    if (mergedCount === 0 && buildResults.length > 0) {
      await safety.incrementFailures(repoPath);
    } else if (mergedCount > 0) {
      await safety.resetFailures(repoPath);
    }

    const outcome = regressions.length > 0 ? 'regression' as const :
                     mergedCount > 0 ? 'productive' as const :
                     buildResults.length > 0 ? 'no-changes' as const : 'stable' as const;

    await recordMemoryEvent(repoPath, 'cycle-complete', `Cycle ${cycle} ${outcome}`, {
      cycle, merged: mergedCount, attempted: buildResults.length, approved: approvedBranches.length,
    });

    return {
      cycle, outcome, changes_merged: mergedCount,
      changes_attempted: buildResults.length,
      changes_approved: approvedBranches.length,
      changes_rejected: rejectedCount,
      duration_ms: Date.now() - startTime,
      api_tokens_used: totalTokens,
      regressions,
    };
  } finally {
    await switchToMain(repoPath).catch(() => { /* ensure cleanup */ });
    await safety.releaseCycleLock(repoPath);
  }
}

function detectRegression(before: StateReport, after: StateReport): string | null {
  if (after.quality.test_pass_rate < before.quality.test_pass_rate) return 'Test pass rate decreased';
  if (after.quality.lint_error_count > before.quality.lint_error_count) return 'New lint errors introduced';
  if (after.quality.test_coverage_percent < before.quality.test_coverage_percent - 2) return 'Coverage dropped >2%';
  return null;
}

async function runRecommendedAction(
  repoPath: string,
  cycle: number,
  report: StateReport,
  plan: CyclePlan,
): Promise<void> {
  const recommendation = plan.action_recommendations?.find(
    (candidate) => candidate.risk === 'read_only' || candidate.risk === 'low',
  );
  if (!recommendation) {
    return;
  }

  const template = getActionTemplate(recommendation.template_id);
  if (!template) {
    await recordMemoryEvent(
      repoPath,
      'implementation-failed',
      `Action template missing: ${recommendation.template_id}`,
      {
        cycle,
        action_template_id: recommendation.template_id,
      },
    );
    return;
  }

  try {
    const context = await loadActionPlanningContext(repoPath, report, { cycle });
    const instance = {
      ...buildActionInstance(template, context),
      cycle,
    };
    const result = await runActionInstance(repoPath, template, instance);

    if (result.status === 'failed' || result.status === 'rejected') {
      await recordMemoryEvent(repoPath, 'implementation-failed', `Action failed: ${template.name}`, {
        cycle,
        action_instance_id: result.id,
        action_template_id: template.id,
        failure_reason: result.failure_reason ?? 'unknown action failure',
      });
    }
  } catch (error) {
    await recordMemoryEvent(repoPath, 'implementation-failed', `Action failed: ${template.name}`, {
      cycle,
      action_template_id: template.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function makeResult(cycle: number, startTime: number, outcome: CycleResult['outcome'], reason?: string): CycleResult {
  return {
    cycle, outcome,
    changes_merged: 0, changes_attempted: 0, changes_approved: 0, changes_rejected: 0,
    duration_ms: Date.now() - startTime,
    api_tokens_used: 0,
    regressions: reason ? [reason] : [],
  };
}
