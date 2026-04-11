import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../../../src/agents/sensory-cortex/index.js');
vi.mock('../../../../src/agents/prefrontal-cortex/index.js');
vi.mock('../../../../src/agents/motor-cortex/index.js');
vi.mock('../../../../src/agents/orchestrator/safety.js', () => ({
  isKillSwitchActive: vi.fn(),
  getConsecutiveFailures: vi.fn(),
  acquireCycleLock: vi.fn(),
  checkApiBudget: vi.fn(),
  releaseCycleLock: vi.fn(),
  recordApiUsage: vi.fn(),
  incrementFailures: vi.fn(),
  resetFailures: vi.fn(),
  setCooldown: vi.fn(),
  isInCooldown: vi.fn(),
  getApiUsage: vi.fn(),
}));
vi.mock('../../../../src/agents/immune-system/baselines.js');
vi.mock('../../../../src/agents/motor-cortex/branch-manager.js');
vi.mock('../../../../src/agents/growth-hormone/index.js', () => ({
  runGrowthHormone: vi.fn().mockResolvedValue({ signals: [], proposals: [] }),
}));
vi.mock('../../../../src/integrations/github/client.js', () => ({
  createGitHubClient: vi.fn().mockReturnValue(null),
}));
vi.mock('../../../../src/integrations/github/pr-formatter.js', () => ({
  formatPRBody: vi.fn().mockReturnValue('PR body'),
  formatPRTitle: vi.fn().mockReturnValue('PR title'),
  getPRLabels: vi.fn().mockReturnValue(['organism']),
}));
vi.mock('../../../../src/agents/immune-system/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../../../src/agents/immune-system/index.js')>(
    '../../../../src/agents/immune-system/index.js',
  );

  return {
    ...actual,
    runImmuneReview: vi.fn(),
  };
});

import { runLifecycleCycle } from '../../../../src/agents/orchestrator/cycle.js';
import type { StateReport } from '../../../../src/agents/sensory-cortex/types.js';
import type { CyclePlan, WorkItem } from '../../../../src/agents/prefrontal-cortex/types.js';
import type { ImplementationResult } from '../../../../src/agents/motor-cortex/types.js';
import type { ReviewVerdict } from '../../../../src/agents/immune-system/types.js';
import { loadKnowledgeBase } from '../../../../src/agents/memory/store.js';
import { listActionInstances } from '../../../../src/agents/actions/history.js';

const mockSafety = vi.mocked(await import('../../../../src/agents/orchestrator/safety.js'));
const mockSensory = vi.mocked(await import('../../../../src/agents/sensory-cortex/index.js'));
const mockPrefrontal = vi.mocked(await import('../../../../src/agents/prefrontal-cortex/index.js'));
const mockMotor = vi.mocked(await import('../../../../src/agents/motor-cortex/index.js'));
const mockImmune = vi.mocked(await import('../../../../src/agents/immune-system/index.js'));
const mockBaselines = vi.mocked(await import('../../../../src/agents/immune-system/baselines.js'));
const mockBranch = vi.mocked(await import('../../../../src/agents/motor-cortex/branch-manager.js'));

const tmpDirs: string[] = [];

function makeStateReport(): StateReport {
  return {
    timestamp: '2026-04-10T00:00:00.000Z',
    version: '1.0.0',
    git: {
      total_commits: 100,
      commits_last_7d: 10,
      commits_last_30d: 40,
      unique_authors_30d: 3,
      active_branches: 5,
      stale_branches: 2,
      last_commit_age_hours: 1,
      avg_commit_size_lines: 50,
    },
    quality: {
      test_file_count: 20,
      source_file_count: 40,
      test_ratio: 0.5,
      test_pass_rate: 0.96,
      test_coverage_percent: 85,
      lint_error_count: 0,
      files_exceeding_length_limit: [],
      functions_exceeding_complexity: [],
    },
    performance: {
      pulse_execution_ms: 100,
      hotspots_execution_ms: 200,
      ghosts_execution_ms: 300,
      benchmarked_against: 'v1.0.0',
    },
    dependencies: {
      total_count: 10,
      outdated_count: 0,
      vulnerable_count: 0,
      outdated_packages: [],
      vulnerabilities: [],
    },
    codebase: {
      total_files: 60,
      total_lines: 5000,
      avg_file_length: 83,
      largest_files: [],
      file_type_distribution: { '.ts': 60 },
    },
    anomalies: [],
    growth_signals: [],
  };
}

function makeWorkItem(id: string, title: string): WorkItem {
  return {
    id,
    tier: 3,
    priority_score: 50,
    title,
    description: `Fix ${title}`,
    rationale: 'Improves quality',
    target_files: ['src/index.ts'],
    estimated_complexity: 'small',
    memory_context: [],
    success_criteria: ['Tests pass'],
    created_by: 'prefrontal-cortex',
    status: 'proposed',
  };
}

function makeCyclePlan(items: WorkItem[]): CyclePlan {
  return {
    cycle_number: 1,
    timestamp: '2026-04-10T00:00:00.000Z',
    state_report_id: '2026-04-10T00:00:00.000Z',
    selected_items: items,
    deferred_items: [],
    rationale: 'Standard prioritization',
    estimated_risk: 'low',
    memory_consulted: true,
    action_recommendations: [
      {
        template_id: 'regression-cluster-draft-stabilization-plan',
        template_version: 1,
        score: 88,
        rationale: ['triggered:1', 'metric_lt'],
        risk: 'low',
      },
    ],
  };
}

function makeBuildResult(workItemId: string, branch: string): ImplementationResult {
  return {
    work_item_id: workItemId,
    branch_name: branch,
    status: 'success',
    files_modified: ['src/index.ts'],
    files_created: [],
    files_deleted: [],
    lines_added: 10,
    lines_removed: 2,
    tests_added: 1,
    tests_modified: 0,
    pre_review_check: { tests_pass: true, lint_clean: true, builds: true },
    claude_tokens_used: 250,
  };
}

function makeVerdict(branch: string): ReviewVerdict {
  return {
    branch,
    timestamp: '2026-04-10T00:00:00.000Z',
    verdict: 'approve',
    confidence: 95,
    summary: `Review of ${branch}`,
    checks: [],
    risks: [],
    recommendation: 'Safe to merge',
  };
}

async function makeTmpRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-action-cycle-'));
  tmpDirs.push(dir);

  await fs.mkdir(path.join(dir, '.organism'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'organism.json'),
    JSON.stringify({
      quality_standards: {
        test_coverage_floor: 80,
        max_complexity_per_function: 15,
        max_file_length: 300,
        zero_tolerance: [],
        performance_budget: {},
      },
      boundaries: {
        growth_zone: ['packages/giti/src/'],
        forbidden_zone: ['.claude/'],
      },
      lifecycle: {
        cycle_frequency: 'daily',
        max_changes_per_cycle: 3,
        mandatory_cooldown_after_regression: '48h',
        branch_naming: 'organism/{cortex}/{description}',
        requires_immune_approval: true,
      },
    }),
    'utf-8',
  );
  await fs.writeFile(
    path.join(dir, '.organism', 'knowledge-base.json'),
    JSON.stringify({
      created: '2026-04-01T00:00:00.000Z',
      last_updated: '2026-04-10T00:00:00.000Z',
      cycle_count: 3,
      events: [],
      lessons: [],
      patterns: {
        fragile_files: [
          {
            path: 'src/index.ts',
            regression_count: 2,
            last_regression: '2026-04-09T00:00:00.000Z',
            notes: 'Needs stabilization',
          },
        ],
        rejection_reasons: {},
        successful_change_types: {},
        failed_change_types: {},
      },
      preferences: [],
    }),
    'utf-8',
  );

  return dir;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockSafety.isKillSwitchActive.mockResolvedValue(false);
  mockSafety.getConsecutiveFailures.mockResolvedValue(0);
  mockSafety.acquireCycleLock.mockResolvedValue(1);
  mockSafety.checkApiBudget.mockResolvedValue(true);
  mockSafety.releaseCycleLock.mockResolvedValue(undefined);
  mockSafety.recordApiUsage.mockResolvedValue(undefined);
  mockSafety.incrementFailures.mockResolvedValue(1);
  mockSafety.resetFailures.mockResolvedValue(undefined);
  mockSafety.setCooldown.mockResolvedValue(undefined);
  mockSafety.isInCooldown.mockResolvedValue(false);
  mockSafety.getApiUsage.mockResolvedValue(null);

  mockBranch.switchToMain.mockResolvedValue(undefined);
  mockBranch.mergeBranch.mockResolvedValue(undefined);
  mockBranch.deleteBranch.mockResolvedValue(undefined);

  mockBaselines.createBaselinesFromReport.mockReturnValue({
    last_updated: '2026-04-10T00:00:00.000Z',
    test_coverage: 85,
    test_count: 20,
    lint_errors: 0,
    performance: { pulse_ms: 100, hotspots_ms: 200, ghosts_ms: 300 },
    complexity: { total: 5000, avg_per_file: 83 },
    dependency_count: 10,
    file_count: 60,
    total_lines: 5000,
  });
  mockBaselines.writeBaselines.mockResolvedValue(undefined);
});

afterEach(async () => {
  await Promise.all(tmpDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tmpDirs.length = 0;
});

describe('runLifecycleCycle action integration', () => {
  it('executes the top low-risk action, persists its outputs, and still proceeds with the build flow', async () => {
    const repoPath = await makeTmpRepo();
    const report = makeStateReport();
    const plan = makeCyclePlan([makeWorkItem('w1', 'Stabilize regressions')]);

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/report.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);
    mockMotor.runMotorCortex.mockResolvedValue(
      makeBuildResult('w1', 'organism/motor/stabilize-regressions'),
    );
    mockImmune.runImmuneReview.mockResolvedValue({
      verdict: makeVerdict('organism/motor/stabilize-regressions'),
      verdictPath: '/tmp/verdict.json',
    });

    const result = await runLifecycleCycle({ repoPath, supervised: false });

    expect(result.outcome).toBe('productive');
    expect(mockMotor.runMotorCortex).toHaveBeenCalledTimes(1);

    const instances = await listActionInstances(repoPath);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.template_id).toBe('regression-cluster-draft-stabilization-plan');
    expect(instances[0]?.status).toBe('succeeded');

    const artifactPath = path.join(
      repoPath,
      '.organism',
      'actions',
      'artifacts',
      'stabilization-plan.md',
    );
    const artifact = await fs.readFile(artifactPath, 'utf-8');
    expect(artifact).toContain('Regression Cluster Draft Stabilization Plan');

    const kb = await loadKnowledgeBase(repoPath);
    expect(
      kb.events.some(
        (event) =>
          event.summary === 'Drafted a stabilization plan from the declarative action engine',
      ),
    ).toBe(true);
    expect(kb.lessons.length).toBeGreaterThan(0);
  });
});
