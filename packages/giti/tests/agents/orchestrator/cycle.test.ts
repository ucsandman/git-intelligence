import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all agent modules before any imports
vi.mock('../../../src/agents/sensory-cortex/index.js');
vi.mock('../../../src/agents/prefrontal-cortex/index.js');
vi.mock('../../../src/agents/motor-cortex/index.js');
vi.mock('../../../src/agents/immune-system/index.js');
vi.mock('../../../src/agents/immune-system/baselines.js');
vi.mock('../../../src/agents/memory/index.js');
vi.mock('../../../src/agents/motor-cortex/branch-manager.js');
vi.mock('../../../src/agents/orchestrator/safety.js');
vi.mock('../../../src/agents/field-observer/index.js', () => ({
  observe: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../src/agents/growth-hormone/index.js', () => ({
  runGrowthHormone: vi.fn().mockResolvedValue({ signals: [], proposals: [] }),
}));
vi.mock('../../../src/integrations/github/client.js', () => ({
  createGitHubClient: vi.fn().mockReturnValue(null), // default: no GitHub
}));
vi.mock('../../../src/integrations/github/pr-formatter.js', () => ({
  formatPRBody: vi.fn().mockReturnValue('PR body'),
  formatPRTitle: vi.fn().mockReturnValue('PR title'),
  getPRLabels: vi.fn().mockReturnValue(['organism']),
}));

import { runLifecycleCycle } from '../../../src/agents/orchestrator/cycle.js';
import type { StateReport } from '../../../src/agents/sensory-cortex/types.js';
import type { CyclePlan, WorkItem } from '../../../src/agents/prefrontal-cortex/types.js';
import type { ImplementationResult } from '../../../src/agents/motor-cortex/types.js';
import type { ReviewVerdict } from '../../../src/agents/immune-system/types.js';

// Get typed mocks
const mockSafety = vi.mocked(await import('../../../src/agents/orchestrator/safety.js'));
const mockSensory = vi.mocked(await import('../../../src/agents/sensory-cortex/index.js'));
const mockPrefrontal = vi.mocked(await import('../../../src/agents/prefrontal-cortex/index.js'));
const mockMotor = vi.mocked(await import('../../../src/agents/motor-cortex/index.js'));
const mockImmune = vi.mocked(await import('../../../src/agents/immune-system/index.js'));
const mockBaselines = vi.mocked(await import('../../../src/agents/immune-system/baselines.js'));
const mockMemory = vi.mocked(await import('../../../src/agents/memory/index.js'));
const mockBranch = vi.mocked(await import('../../../src/agents/motor-cortex/branch-manager.js'));
const mockFieldObserver = vi.mocked(await import('../../../src/agents/field-observer/index.js'));

// === Test Fixtures ===

function makeStateReport(overrides?: Partial<StateReport>): StateReport {
  return {
    timestamp: '2026-04-04T00:00:00.000Z',
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
      test_pass_rate: 100,
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
    ...overrides,
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
    timestamp: '2026-04-04T00:00:00.000Z',
    state_report_id: '2026-04-04T00:00:00.000Z',
    selected_items: items,
    deferred_items: [],
    rationale: 'Standard prioritization',
    estimated_risk: 'low',
    memory_consulted: false,
  };
}

function makeBuildResult(workItemId: string, branch: string, status: ImplementationResult['status'] = 'success', tokens = 500): ImplementationResult {
  return {
    work_item_id: workItemId,
    branch_name: branch,
    status,
    files_modified: ['src/index.ts'],
    files_created: [],
    files_deleted: [],
    lines_added: 10,
    lines_removed: 2,
    tests_added: 1,
    tests_modified: 0,
    pre_review_check: { tests_pass: true, lint_clean: true, builds: true },
    claude_tokens_used: tokens,
  };
}

function makeVerdict(branch: string, verdict: ReviewVerdict['verdict'] = 'approve'): ReviewVerdict {
  return {
    branch,
    timestamp: '2026-04-04T00:00:00.000Z',
    verdict,
    confidence: 95,
    summary: `Review of ${branch}`,
    checks: [],
    risks: [],
    recommendation: verdict === 'approve' ? 'Safe to merge' : 'Do not merge',
  };
}

// === Setup ===

beforeEach(() => {
  vi.clearAllMocks();

  // Default safety mocks: all green
  mockSafety.isKillSwitchActive.mockResolvedValue(false);
  mockSafety.getConsecutiveFailures.mockResolvedValue(0);
  mockSafety.acquireCycleLock.mockResolvedValue(1);
  mockSafety.checkApiBudget.mockResolvedValue(true);
  mockSafety.releaseCycleLock.mockResolvedValue(undefined);
  mockSafety.recordApiUsage.mockResolvedValue(undefined);
  mockSafety.incrementFailures.mockResolvedValue(1);
  mockSafety.resetFailures.mockResolvedValue(undefined);
  mockSafety.setCooldown.mockResolvedValue(undefined);

  // Default memory mock
  mockMemory.recordMemoryEvent.mockResolvedValue(undefined);

  // Default branch manager mocks
  mockBranch.switchToMain.mockResolvedValue(undefined);
  mockBranch.mergeBranch.mockResolvedValue(undefined);
  mockBranch.deleteBranch.mockResolvedValue(undefined);

  // Default field-observer mock: no targets configured
  mockFieldObserver.observe.mockResolvedValue([]);

  // Default baselines mocks
  mockBaselines.createBaselinesFromReport.mockReturnValue({
    last_updated: '2026-04-04T00:00:00.000Z',
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

// === Tests ===

describe('runLifecycleCycle', () => {
  it('happy path: sense→plan→build→review→merge→reflect = productive', async () => {
    const report = makeStateReport();
    const items = [makeWorkItem('w1', 'Fix lint'), makeWorkItem('w2', 'Add tests')];
    const plan = makeCyclePlan(items);

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/report.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);
    mockMotor.runMotorCortex
      .mockResolvedValueOnce(makeBuildResult('w1', 'organism/motor/fix-lint', 'success', 400))
      .mockResolvedValueOnce(makeBuildResult('w2', 'organism/motor/add-tests', 'success', 600));
    mockImmune.runImmuneReview
      .mockResolvedValueOnce({ verdict: makeVerdict('organism/motor/fix-lint', 'approve'), verdictPath: '/tmp/v1.json' })
      .mockResolvedValueOnce({ verdict: makeVerdict('organism/motor/add-tests', 'approve'), verdictPath: '/tmp/v2.json' });

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(result.outcome).toBe('productive');
    expect(result.changes_merged).toBe(2);
    expect(result.changes_attempted).toBe(2);
    expect(result.changes_approved).toBe(2);
    expect(result.changes_rejected).toBe(0);
    expect(result.api_tokens_used).toBe(1000);
    expect(result.cycle).toBe(1);
    expect(result.regressions).toEqual([]);
    expect(mockSafety.resetFailures).toHaveBeenCalled();
  });

  it('no work items: plan returns 0 selected → stable', async () => {
    const report = makeStateReport();
    const plan = makeCyclePlan([]);

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/report.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(result.outcome).toBe('stable');
    expect(result.changes_merged).toBe(0);
    expect(result.changes_attempted).toBe(0);
    // Motor cortex should not be called
    expect(mockMotor.runMotorCortex).not.toHaveBeenCalled();
  });

  it('build fails on one item: still reviews and merges the other', async () => {
    const report = makeStateReport();
    const items = [makeWorkItem('w1', 'Good change'), makeWorkItem('w2', 'Bad change')];
    const plan = makeCyclePlan(items);

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/report.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);
    mockMotor.runMotorCortex
      .mockResolvedValueOnce(makeBuildResult('w1', 'organism/motor/good-change', 'success', 500))
      .mockRejectedValueOnce(new Error('Build exploded'));
    mockImmune.runImmuneReview
      .mockResolvedValueOnce({ verdict: makeVerdict('organism/motor/good-change', 'approve'), verdictPath: '/tmp/v1.json' });

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(result.outcome).toBe('productive');
    expect(result.changes_merged).toBe(1);
    expect(result.changes_attempted).toBe(1);
    expect(result.changes_approved).toBe(1);
    // Only 1 build result, so immune review only called once
    expect(mockImmune.runImmuneReview).toHaveBeenCalledTimes(1);
  });

  it('review rejects: changes_rejected incremented, changes_merged 0', async () => {
    const report = makeStateReport();
    const items = [makeWorkItem('w1', 'Risky change')];
    const plan = makeCyclePlan(items);

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/report.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);
    mockMotor.runMotorCortex.mockResolvedValueOnce(makeBuildResult('w1', 'organism/motor/risky-change'));
    mockImmune.runImmuneReview.mockResolvedValueOnce({
      verdict: makeVerdict('organism/motor/risky-change', 'reject'),
      verdictPath: '/tmp/v1.json',
    });

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(result.changes_rejected).toBe(1);
    expect(result.changes_merged).toBe(0);
    expect(result.changes_approved).toBe(0);
    expect(result.outcome).toBe('no-changes');
    expect(mockSafety.incrementFailures).toHaveBeenCalled();
  });

  it('kill switch active at start: returns aborted immediately', async () => {
    mockSafety.isKillSwitchActive.mockResolvedValue(true);

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(result.outcome).toBe('aborted');
    expect(result.regressions).toContain('Kill switch active');
    expect(mockSensory.runSensoryCortex).not.toHaveBeenCalled();
    expect(mockSafety.acquireCycleLock).not.toHaveBeenCalled();
  });

  it('kill switch mid-cycle: stops building after plan', async () => {
    const report = makeStateReport();
    const items = [makeWorkItem('w1', 'Item 1'), makeWorkItem('w2', 'Item 2')];
    const plan = makeCyclePlan(items);

    // Kill switch is off initially, off for observe phase, off for sense phase,
    // off for plan phase, off for grow phase, then ON for build phase
    mockSafety.isKillSwitchActive
      .mockResolvedValueOnce(false)  // pre-flight
      .mockResolvedValueOnce(false)  // before observe
      .mockResolvedValueOnce(false)  // before sense
      .mockResolvedValueOnce(false)  // before plan
      .mockResolvedValueOnce(false)  // before grow
      .mockResolvedValueOnce(true);  // before build loop

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/report.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    // Build never happens, so no items attempted
    expect(mockMotor.runMotorCortex).not.toHaveBeenCalled();
    expect(result.changes_attempted).toBe(0);
    expect(result.outcome).toBe('stable');
  });

  it('supervised mode: does not merge, returns approved branches', async () => {
    const report = makeStateReport();
    const items = [makeWorkItem('w1', 'Change A')];
    const plan = makeCyclePlan(items);

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/report.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);
    mockMotor.runMotorCortex.mockResolvedValueOnce(makeBuildResult('w1', 'organism/motor/change-a'));
    mockImmune.runImmuneReview.mockResolvedValueOnce({
      verdict: makeVerdict('organism/motor/change-a', 'approve'),
      verdictPath: '/tmp/v.json',
    });

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: true });

    expect(result.outcome).toBe('human-declined');
    expect(result.changes_merged).toBe(0);
    expect(result.changes_approved).toBe(1);
    expect(mockBranch.mergeBranch).not.toHaveBeenCalled();
  });

  it('regression detected: post-merge scan shows degraded metrics → cooldown', async () => {
    const report = makeStateReport();
    const items = [makeWorkItem('w1', 'Introduce bug')];
    const plan = makeCyclePlan(items);

    // Post-merge report has worse metrics
    const postReport = makeStateReport({
      quality: {
        ...makeStateReport().quality,
        test_pass_rate: 90, // dropped from 100
      },
    });

    mockSensory.runSensoryCortex
      .mockResolvedValueOnce({ report, reportPath: '/tmp/r1.json' })       // Phase 1
      .mockResolvedValueOnce({ report: postReport, reportPath: '/tmp/r2.json' }); // Phase 6
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);
    mockMotor.runMotorCortex.mockResolvedValueOnce(makeBuildResult('w1', 'organism/motor/introduce-bug'));
    mockImmune.runImmuneReview.mockResolvedValueOnce({
      verdict: makeVerdict('organism/motor/introduce-bug', 'approve'),
      verdictPath: '/tmp/v.json',
    });

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(result.outcome).toBe('regression');
    expect(result.regressions).toContain('Test pass rate decreased');
    expect(mockSafety.setCooldown).toHaveBeenCalledWith('/repo', 48 * 60 * 60 * 1000);
  });

  it('3+ consecutive failures: returns aborted without starting', async () => {
    mockSafety.getConsecutiveFailures.mockResolvedValue(3);

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(result.outcome).toBe('aborted');
    expect(result.regressions).toContain('3+ consecutive failures');
    expect(mockSensory.runSensoryCortex).not.toHaveBeenCalled();
  });

  it('lock released on error: build phase throws, lock is still released', async () => {
    const report = makeStateReport();

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/r.json' });
    mockPrefrontal.runPrefrontalCortex.mockRejectedValue(new Error('Prefrontal crashed'));

    // The error propagates through the try/finally, so the promise rejects
    await expect(runLifecycleCycle({ repoPath: '/repo', supervised: false })).rejects.toThrow('Prefrontal crashed');

    // But the finally block still runs — lock is released and main is restored
    expect(mockSafety.releaseCycleLock).toHaveBeenCalledWith('/repo');
    expect(mockBranch.switchToMain).toHaveBeenCalled();
  });

  it('API budget exceeded: stops building when budget runs out', async () => {
    const report = makeStateReport();
    const items = [makeWorkItem('w1', 'Item 1'), makeWorkItem('w2', 'Item 2')];
    const plan = makeCyclePlan(items);

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/r.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);

    // Budget available for first item, exhausted before second
    mockSafety.checkApiBudget
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    mockMotor.runMotorCortex.mockResolvedValueOnce(makeBuildResult('w1', 'organism/motor/item-1'));
    mockImmune.runImmuneReview.mockResolvedValueOnce({
      verdict: makeVerdict('organism/motor/item-1', 'approve'),
      verdictPath: '/tmp/v.json',
    });

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    // Only 1 build should have happened
    expect(mockMotor.runMotorCortex).toHaveBeenCalledTimes(1);
    expect(result.changes_attempted).toBe(1);
    expect(result.changes_merged).toBe(1);
  });

  it('token tracking: totalTokens accumulated across builds', async () => {
    const report = makeStateReport();
    const items = [makeWorkItem('w1', 'A'), makeWorkItem('w2', 'B'), makeWorkItem('w3', 'C')];
    const plan = makeCyclePlan(items);

    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/r.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);
    mockMotor.runMotorCortex
      .mockResolvedValueOnce(makeBuildResult('w1', 'organism/motor/a', 'success', 100))
      .mockResolvedValueOnce(makeBuildResult('w2', 'organism/motor/b', 'success', 250))
      .mockResolvedValueOnce(makeBuildResult('w3', 'organism/motor/c', 'success', 350));
    mockImmune.runImmuneReview
      .mockResolvedValueOnce({ verdict: makeVerdict('organism/motor/a', 'approve'), verdictPath: '/v1' })
      .mockResolvedValueOnce({ verdict: makeVerdict('organism/motor/b', 'approve'), verdictPath: '/v2' })
      .mockResolvedValueOnce({ verdict: makeVerdict('organism/motor/c', 'approve'), verdictPath: '/v3' });

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(result.api_tokens_used).toBe(700); // 100 + 250 + 350
    expect(mockSafety.recordApiUsage).toHaveBeenCalledTimes(3);
    expect(mockSafety.recordApiUsage).toHaveBeenCalledWith('/repo', 100);
    expect(mockSafety.recordApiUsage).toHaveBeenCalledWith('/repo', 250);
    expect(mockSafety.recordApiUsage).toHaveBeenCalledWith('/repo', 350);
  });
});

describe('OBSERVE_EXTERNAL phase', () => {
  it('calls field-observer.observe before runSensoryCortex', async () => {
    const callOrder: string[] = [];
    const report = makeStateReport();
    const plan = makeCyclePlan([]);

    mockFieldObserver.observe.mockImplementationOnce(async () => {
      callOrder.push('observe');
      return [];
    });
    mockSensory.runSensoryCortex.mockImplementationOnce(async () => {
      callOrder.push('sense');
      return { report, reportPath: '/tmp/report.json' };
    });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    expect(callOrder[0]).toBe('observe');
    expect(callOrder[1]).toBe('sense');
    expect(mockFieldObserver.observe).toHaveBeenCalledWith('/repo', 1);
    expect(result.outcome).toBe('stable');
  });

  it('does not fail the cycle when observe() throws', async () => {
    const report = makeStateReport();
    const plan = makeCyclePlan([]);

    mockFieldObserver.observe.mockRejectedValueOnce(new Error('boom'));
    mockSensory.runSensoryCortex.mockResolvedValue({ report, reportPath: '/tmp/report.json' });
    mockPrefrontal.runPrefrontalCortex.mockResolvedValue(plan);

    const result = await runLifecycleCycle({ repoPath: '/repo', supervised: false });

    // Cycle should still complete — observe failure is non-fatal
    expect(result.outcome).toBeDefined();
    expect(['stable', 'no-changes']).toContain(result.outcome);
    // Sensory cortex should still have been called despite observe() throwing
    expect(mockSensory.runSensoryCortex).toHaveBeenCalled();
  });
});
