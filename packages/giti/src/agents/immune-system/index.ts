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
import type { ReviewVerdict, ReviewRisk, RegressionContext } from './types.js';

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

  // 4. Run all 7 checks in parallel
  const [testResult, qualityResult, performanceResult, boundaryResult, regressionResult, dependencyResult, secretResult] =
    await Promise.all([
      runTestCheck(repoPath, baselines, config),
      runQualityCheck(repoPath, baselines, config),
      runPerformanceCheck(repoPath, config, baselines),
      runBoundaryCheck(repoPath, branch, config),
      runRegressionCheck(repoPath, branch, regressionContext),
      runDependencyCheck(repoPath, branch),
      runSecretScan(repoPath, branch),
    ]);

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
