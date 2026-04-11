import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StateReport } from '../../../src/agents/sensory-cortex/types.js';

vi.mock('../../../src/agents/actions/context.js', () => ({
  loadActionPlanningContext: vi.fn(),
}));

vi.mock('../../../src/agents/prefrontal-cortex/backlog.js', () => ({
  loadBacklog: vi.fn(),
  saveWorkItem: vi.fn(),
  saveCyclePlan: vi.fn(),
}));

vi.mock('../../../src/agents/prefrontal-cortex/prioritizer.js', () => ({
  generateWorkItems: vi.fn(),
  prioritizeItems: vi.fn(),
  generateGrowthItems: vi.fn(),
}));

vi.mock('../../../src/agents/growth-hormone/index.js', () => ({
  loadApprovedProposals: vi.fn(),
}));

vi.mock('../../../src/agents/utils.js', () => ({
  loadOrganismConfig: vi.fn(),
  readJsonFile: vi.fn(),
  getOrganismPath: vi.fn((repoPath: string, ...parts: string[]) => [repoPath, '.organism', ...parts].join('/')),
}));

vi.mock('../../../src/agents/memory/store.js', () => ({
  loadKnowledgeBase: vi.fn(),
}));

import { loadActionPlanningContext } from '../../../src/agents/actions/context.js';
import {
  buildActionInstance,
  planActions,
  scoreActionCandidate,
} from '../../../src/agents/actions/planner.js';
import { runPrefrontalCortex } from '../../../src/agents/prefrontal-cortex/index.js';
import { loadBacklog, saveCyclePlan } from '../../../src/agents/prefrontal-cortex/backlog.js';
import {
  generateGrowthItems,
  generateWorkItems,
  prioritizeItems,
} from '../../../src/agents/prefrontal-cortex/prioritizer.js';
import { loadApprovedProposals } from '../../../src/agents/growth-hormone/index.js';
import { loadOrganismConfig, readJsonFile } from '../../../src/agents/utils.js';
import { loadKnowledgeBase } from '../../../src/agents/memory/store.js';

const mockLoadActionPlanningContext = vi.mocked(loadActionPlanningContext);
const mockLoadBacklog = vi.mocked(loadBacklog);
const mockSaveCyclePlan = vi.mocked(saveCyclePlan);
const mockGenerateWorkItems = vi.mocked(generateWorkItems);
const mockPrioritizeItems = vi.mocked(prioritizeItems);
const mockGenerateGrowthItems = vi.mocked(generateGrowthItems);
const mockLoadApprovedProposals = vi.mocked(loadApprovedProposals);
const mockLoadOrganismConfig = vi.mocked(loadOrganismConfig);
const mockReadJsonFile = vi.mocked(readJsonFile);
const mockLoadKnowledgeBase = vi.mocked(loadKnowledgeBase);

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

function makeContext() {
  return {
    repo_path: '/repo',
    state_report: makeStateReport(),
    memory: {
      events: [
        {
          id: 'event-1',
          type: 'regression-detected',
          timestamp: '2026-04-09T12:00:00.000Z',
        },
      ],
      lessons: [],
    },
    config: {
      boundaries: {
        growth_zone: ['packages/giti/src/'],
        forbidden_zone: ['.claude/'],
      },
    },
    runtime: {
      branch_clean: true,
      in_cooldown: false,
      api_budget_remaining: 2000,
      integrations: {
        github: false,
        dashclaw: false,
        openclaw: false,
        anthropic: false,
      },
    },
  };
}

function makeTemplate(id: string, triggerValue = 0, status: 'active' | 'deprecated' | 'disabled' = 'active') {
  return {
    id,
    name: `Action ${id}`,
    version: 1,
    status,
    intent: `Intent for ${id}`,
    description: `Description for ${id}`,
    triggers: [
      {
        type: 'metric_gt',
        metric: 'quality.test_coverage_percent',
        value: triggerValue,
      },
    ],
    inputs: [
      {
        name: 'state_report',
        source: 'state_report',
        required: true,
      },
    ],
    constraints: [],
    risk: 'low',
    effects: ['records_memory'],
    steps: [
      {
        id: `${id}-step`,
        title: 'Record an event',
        type: 'record_event',
        event_type: 'plan-created',
        summary: 'Recorded from planner test',
      },
    ],
    success_criteria: [
      {
        type: 'event_recorded',
        event_type: 'plan-created',
      },
    ],
    learning_hooks: [
      {
        type: 'record_event',
      },
    ],
    provenance: {
      source: 'built_in',
      created_at: '2026-04-10T00:00:00.000Z',
      updated_at: '2026-04-10T00:00:00.000Z',
    },
  };
}

describe('planner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLoadActionPlanningContext.mockResolvedValue(makeContext());
  });

  it('returns no candidates when triggers fail', async () => {
    const results = await planActions('/repo', makeStateReport(), {
      templates: [makeTemplate('too-strict', 100)],
    });

    expect(results).toEqual([]);
  });

  it('scores and sorts eligible actions', async () => {
    const results = await planActions('/repo', makeStateReport(), {
      templates: [makeTemplate('lower-score', 86), makeTemplate('higher-score', 50)],
    });

    expect(results.map((result) => result.template_id)).toEqual([
      'higher-score',
      'lower-score',
    ]);
  });

  it('builds a bound action instance from a template', () => {
    const instance = buildActionInstance(makeTemplate('bind-me'), makeContext());

    expect(instance.template_id).toBe('bind-me');
    expect(instance.status).toBe('planned');
    expect(instance.bound_inputs).toMatchObject({
      repo_path: '/repo',
    });
  });

  it('excludes disabled templates', async () => {
    const results = await planActions('/repo', makeStateReport(), {
      templates: [makeTemplate('disabled-template', 0, 'disabled')],
    });

    expect(results).toEqual([]);
  });

  it('assigns a higher score to easier low-risk candidates', () => {
    const higher = scoreActionCandidate(makeTemplate('higher', 50), makeContext());
    const lower = scoreActionCandidate(
      {
        ...makeTemplate('lower', 50),
        risk: 'high',
      },
      makeContext(),
    );

    expect(higher).toBeGreaterThan(lower);
  });
});

describe('runPrefrontalCortex action recommendations', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockLoadOrganismConfig.mockResolvedValue({
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
    mockLoadKnowledgeBase.mockResolvedValue({
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
    mockLoadBacklog.mockResolvedValue([]);
    mockReadJsonFile.mockResolvedValue(null);
    mockGenerateWorkItems.mockReturnValue([]);
    mockLoadApprovedProposals.mockResolvedValue([]);
    mockGenerateGrowthItems.mockReturnValue([]);
    mockPrioritizeItems.mockReturnValue({
      selected: [],
      deferred: [],
    });
    mockSaveCyclePlan.mockResolvedValue();
    mockLoadActionPlanningContext.mockResolvedValue(makeContext());
  });

  it('attaches action recommendations to the cycle plan', async () => {
    const plan = await runPrefrontalCortex('/repo', makeStateReport(), true);

    expect(plan.action_recommendations?.[0]?.template_id).toBeDefined();
    expect(plan.action_recommendations?.[0]?.score).toBeGreaterThan(0);
  });
});
