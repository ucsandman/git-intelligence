import { loadOrganismConfig, readJsonFile, writeJsonFile, ensureOrganismDir, getOrganismPath } from '../utils.js';
import { readBaselines } from './baselines.js';
import { runTestCheck } from './checks/test-check.js';
import { runQualityCheck } from './checks/quality-check.js';
import { runPerformanceCheck } from './checks/performance-check.js';
import { runBoundaryCheck } from './checks/boundary-check.js';
import { runRegressionCheck } from './checks/regression-check.js';
import { runDependencyCheck } from './checks/dependency-check.js';
import { runSecretScan } from './checks/secret-scan.js';
import { generateVerdict } from './verdict.js';
import type {
  ActionPolicyReason,
  ActionPolicyVerdict,
  ReviewVerdict,
  ReviewRisk,
  RegressionContext,
} from './types.js';
import type { ActionInstance, ActionTemplate } from '../actions/types.js';
import * as safety from '../orchestrator/safety.js';
import path from 'node:path';

interface KnowledgeBase {
  patterns?: {
    fragile_files?: Array<{
      path: string;
      regression_count: number;
      last_regression: string;
      notes: string;
    }>;
  };
}

export async function runImmuneReview(
  repoPath: string,
  branch: string,
): Promise<{ verdict: ReviewVerdict; verdictPath: string }> {
  // 1. Load organism config
  const config = await loadOrganismConfig(repoPath);

  // 2. Read baselines
  const baselines = await readBaselines(repoPath);

  // 3. Load knowledge base for regression context
  const kb = await readJsonFile<KnowledgeBase>(getOrganismPath(repoPath, 'knowledge-base.json'));

  let regressionContext: RegressionContext | null = null;
  if (kb?.patterns?.fragile_files && kb.patterns.fragile_files.length > 0) {
    regressionContext = {
      fragile_files: kb.patterns.fragile_files,
    };
  }

  // 4. Run checks sequentially. Parallelism here was unsafe because
  // runTestCheck mutates the working tree (git stash + checkout main +
  // checkout back + stash pop) while other checks read it. CPU contention
  // between concurrent vitest + tsc runs also pushed coverage past its
  // 120s timeout. Sequential is ~30s slower per cycle; correctness wins.
  const testResult = await runTestCheck(repoPath, baselines, config);
  const qualityResult = await runQualityCheck(repoPath, baselines, config);
  const performanceResult = await runPerformanceCheck(repoPath, config, baselines);
  const boundaryResult = await runBoundaryCheck(repoPath, branch, config);
  const regressionResult = await runRegressionCheck(repoPath, branch, regressionContext);
  const dependencyResult = await runDependencyCheck(repoPath, branch);
  const secretResult = await runSecretScan(repoPath, branch);

  const checks = [testResult, qualityResult, performanceResult, boundaryResult, regressionResult, dependencyResult, secretResult];

  // 5. Collect risks from checks
  const risks: ReviewRisk[] = [];
  for (const check of checks) {
    if (check.status === 'fail') {
      risks.push({
        description: check.message,
        severity: 'high',
      });
    } else if (check.status === 'warn') {
      risks.push({
        description: check.message,
        severity: 'medium',
      });
    }
  }

  // 6. Generate verdict
  const verdict = generateVerdict(branch, checks, risks);

  // 7. Write verdict to .organism/reviews/
  await ensureOrganismDir(repoPath, 'reviews');

  const branchSlug = branch.replace(/\//g, '-');
  const tsSlug = verdict.timestamp.replace(/:/g, '-');
  const verdictPath = getOrganismPath(repoPath, 'reviews', `${branchSlug}-${tsSlug}.json`);

  await writeJsonFile(verdictPath, verdict);

  // 8. Return verdict and path
  return { verdict, verdictPath };
}

function isWritePathAllowed(repoPath: string, relativePath: string): boolean {
  const allowedRoot = path.resolve(repoPath, '.organism');
  const target = path.resolve(repoPath, relativePath);
  return target === allowedRoot || target.startsWith(`${allowedRoot}${path.sep}`);
}

export async function reviewActionPlan(
  repoPath: string,
  template: ActionTemplate,
  _instance: ActionInstance,
): Promise<ActionPolicyVerdict> {
  const reasons: ActionPolicyReason[] = [];

  if (template.risk === 'read_only') {
    return { allowed: true, reasons };
  }

  if (await safety.isKillSwitchActive(repoPath)) {
    reasons.push({
      code: 'kill-switch',
      message: 'Action execution is blocked while the organism kill switch is active.',
    });
  }

  if (await safety.isInCooldown(repoPath)) {
    reasons.push({
      code: 'cooldown',
      message: 'Action execution is blocked while the organism is in cooldown.',
    });
  }

  for (const step of template.steps) {
    if (step.type === 'write_artifact' && !isWritePathAllowed(repoPath, step.path)) {
      reasons.push({
        code: 'write-root',
        message: `Action write path must stay under .organism/: ${step.path}`,
      });
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
