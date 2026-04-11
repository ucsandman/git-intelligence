import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StateReport } from '../../../src/agents/sensory-cortex/types.js';
import type { ActionPlanningContext } from '../../../src/agents/actions/types.js';

vi.mock('../../../src/agents/memory/store.js', () => ({
  loadKnowledgeBase: vi.fn(),
}));

vi.mock('../../../src/agents/utils.js', () => ({
  loadOrganismConfig: vi.fn(),
  runCommand: vi.fn(),
}));

vi.mock('../../../src/agents/orchestrator/safety.js', () => ({
  isInCooldown: vi.fn(),
  getApiUsage: vi.fn(),
}));

import { loadKnowledgeBase } from '../../../src/agents/memory/store.js';
import { loadOrganismConfig, runCommand } from '../../../src/agents/utils.js';
import { getApiUsage, isInCooldown } from '../../../src/agents/orchestrator/safety.js';
import { loadActionPlanningContext } from '../../../src/agents/actions/context.js';
import { evaluatePredicate, evaluatePredicates } from '../../../src/agents/actions/predicates.js';

const mockLoadKnowledgeBase = vi.mocked(loadKnowledgeBase);
const mockLoadOrganismConfig = vi.mocked(loadOrganismConfig);
const mockRunCommand = vi.mocked(runCommand);
const mockGetApiUsage = vi.mocked(getApiUsage);
const mockIsInCooldown = vi.mocked(isInCooldown);

function makeContext(): ActionPlanningContext {
  return {
    repo_path: '/repo',
    state_report: {
      quality: {
        test_coverage_percent: 87,
        lint_error_count: 2,
      },
    },
    memory: {
      events: [
        {
          id: 'event-1',
          type: 'regression-detected',
          timestamp: '2026-04-09T12:00:00.000Z',
        },
        {
          id: 'event-2',
          type: 'plan-created',
          timestamp: '2026-04-10T12:00:00.000Z',
        },
      ],
      lessons: [
        {
          id: 'lesson-1',
          category: 'regressions',
          confidence: 0.9,
        },
      ],
    },
    config: {
      boundaries: {
        growth_zone: ['packages/giti/src/'],
        forbidden_zone: ['node_modules/', '.claude/'],
      },
    },
    runtime: {
      branch_clean: true,
      in_cooldown: false,
      api_budget_remaining: 1250,
      integrations: {
        github: true,
        dashclaw: false,
        openclaw: false,
        anthropic: true,
      },
    },
  };
}

function makeStateReport(): StateReport {
  return {
    timestamp: '2026-04-10T00:00:00.000Z',
    version: '1',
    git: {
      total_commits: 100,
      commits_last_7d: 12,
      commits_last_30d: 40,
      unique_authors_30d: 3,
      active_branches: 5,
      stale_branches: 1,
      last_commit_age_hours: 2,
      avg_commit_size_lines: 23,
    },
    quality: {
      test_file_count: 20,
      source_file_count: 50,
      test_ratio: 0.4,
      test_pass_rate: 0.96,
      test_coverage_percent: 87,
      lint_error_count: 2,
      files_exceeding_length_limit: [],
      functions_exceeding_complexity: [],
    },
    performance: {
      pulse_execution_ms: 120,
      hotspots_execution_ms: 450,
      ghosts_execution_ms: 300,
      benchmarked_against: '10k commits',
    },
    dependencies: {
      total_count: 25,
      outdated_count: 1,
      vulnerable_count: 0,
      outdated_packages: [],
      vulnerabilities: [],
    },
    codebase: {
      total_files: 70,
      total_lines: 6000,
      avg_file_length: 86,
      largest_files: [],
      file_type_distribution: { ts: 60 },
    },
    anomalies: [],
    growth_signals: [],
  };
}

describe('evaluatePredicate', () => {
  it('evaluates metric_gt predicates', () => {
    const passed = evaluatePredicate(
      { type: 'metric_gt', metric: 'quality.test_coverage_percent', value: 80 },
      makeContext(),
    );

    expect(passed).toBe(true);
  });

  it('evaluates metric_lt predicates', () => {
    const passed = evaluatePredicate(
      { type: 'metric_lt', metric: 'quality.lint_error_count', value: 3 },
      makeContext(),
    );

    expect(passed).toBe(true);
  });

  it('evaluates event_count_since predicates', () => {
    const passed = evaluatePredicate(
      {
        type: 'event_count_since',
        event_type: 'regression-detected',
        since: '2026-04-08T00:00:00.000Z',
        min_count: 1,
      },
      makeContext(),
    );

    expect(passed).toBe(true);
  });

  it('evaluates lesson_confidence_gte predicates', () => {
    const passed = evaluatePredicate(
      { type: 'lesson_confidence_gte', category: 'regressions', min_confidence: 0.8 },
      makeContext(),
    );

    expect(passed).toBe(true);
  });

  it('evaluates file_matches_boundary predicates', () => {
    const passed = evaluatePredicate(
      {
        type: 'file_matches_boundary',
        boundary: 'growth_zone',
        paths: ['packages/giti/src/agents/actions/schema.ts'],
        match: 'any',
      },
      makeContext(),
    );

    expect(passed).toBe(true);
  });

  it('evaluates branch_is_clean predicates', () => {
    const passed = evaluatePredicate({ type: 'branch_is_clean', expected: true }, makeContext());

    expect(passed).toBe(true);
  });

  it('evaluates cooldown_inactive predicates', () => {
    const passed = evaluatePredicate({ type: 'cooldown_inactive' }, makeContext());

    expect(passed).toBe(true);
  });

  it('evaluates budget_available predicates', () => {
    const passed = evaluatePredicate(
      { type: 'budget_available', minimum_remaining: 1000 },
      makeContext(),
    );

    expect(passed).toBe(true);
  });

  it('evaluates integration_configured predicates', () => {
    const passed = evaluatePredicate(
      { type: 'integration_configured', integration: 'github' },
      makeContext(),
    );

    expect(passed).toBe(true);
  });

  it('reports failed predicate descriptions from evaluatePredicates', () => {
    const result = evaluatePredicates(
      [
        { type: 'metric_gt', metric: 'quality.test_coverage_percent', value: 80 },
        { type: 'integration_configured', integration: 'dashclaw' },
      ],
      makeContext(),
    );

    expect(result.passed).toBe(false);
    expect(result.failed).toEqual(['integration_configured']);
  });
});

describe('loadActionPlanningContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads context from organism modules and runtime state', async () => {
    mockLoadKnowledgeBase.mockResolvedValueOnce({
      created: '2026-04-01T00:00:00.000Z',
      last_updated: '2026-04-10T00:00:00.000Z',
      cycle_count: 3,
      events: [],
      lessons: [],
      patterns: {
        fragile_files: [],
        rejection_reasons: {},
        successful_change_types: {},
        failed_change_types: {},
      },
      preferences: [],
    });
    mockLoadOrganismConfig.mockResolvedValueOnce({
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
    });
    mockRunCommand.mockReturnValueOnce({
      stdout: '',
      stderr: '',
      status: 0,
    });
    mockIsInCooldown.mockResolvedValueOnce(true);
    mockGetApiUsage.mockResolvedValueOnce({
      total_tokens: 2500,
      monthly_tokens: 600,
      month: '2026-04',
      budget: 2000,
    });

    const context = await loadActionPlanningContext('/repo', makeStateReport());

    expect(context.repo_path).toBe('/repo');
    expect(context.state_report).toEqual(makeStateReport());
    expect(context.runtime).toMatchObject({
      branch_clean: true,
      in_cooldown: true,
      api_budget_remaining: 1400,
    });
    expect(context.runtime?.integrations).toMatchObject({
      github: false,
      dashclaw: false,
      openclaw: false,
      anthropic: false,
    });
  });
});
