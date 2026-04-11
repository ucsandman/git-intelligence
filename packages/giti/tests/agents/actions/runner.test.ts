import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadActionInstance } from '../../../src/agents/actions/history.js';
import { runActionInstance } from '../../../src/agents/actions/runner.js';
import { reviewActionPlan } from '../../../src/agents/immune-system/index.js';
import type { ActionInstance, ActionTemplate } from '../../../src/agents/actions/types.js';

const tmpDirs: string[] = [];

async function makeTmpRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-actions-runner-'));
  tmpDirs.push(dir);
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
  return dir;
}

function makeInstance(id: string): ActionInstance {
  return {
    id,
    template_id: 'runner-template',
    template_version: 1,
    status: 'planned',
    bound_inputs: {
      repo_path: '/repo',
      state_report: {
        quality: {
          test_pass_rate: 0.94,
        },
      },
      memory: {
        lessons: [],
        events: [],
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
        api_budget_remaining: 1500,
        integrations: {
          github: false,
          dashclaw: false,
          openclaw: false,
          anthropic: false,
        },
      },
    },
    step_results: [],
  };
}

function makeTemplate(steps: ActionTemplate['steps'], risk: ActionTemplate['risk'] = 'low'): ActionTemplate {
  return {
    id: 'runner-template',
    name: 'Runner Template',
    version: 1,
    status: 'active',
    intent: 'Test action runner behavior',
    description: 'Used by the action runner test suite.',
    triggers: [],
    inputs: [],
    constraints: [],
    risk,
    effects: risk === 'read_only' ? [] : ['writes_files', 'records_memory'],
    steps,
    success_criteria: [],
    learning_hooks: [],
    provenance: {
      source: 'built_in',
      created_at: '2026-04-10T00:00:00.000Z',
      updated_at: '2026-04-10T00:00:00.000Z',
    },
  };
}

afterEach(async () => {
  await Promise.all(tmpDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tmpDirs.length = 0;
});

beforeEach(() => {
  delete process.env['ANTHROPIC_API_KEY'];
});

describe('reviewActionPlan', () => {
  it('auto-approves read_only plans', async () => {
    const repoPath = await makeTmpRepo();
    const verdict = await reviewActionPlan(
      repoPath,
      makeTemplate(
        [
          {
            id: 'read-state',
            title: 'Read state',
            type: 'read_repo_state',
          },
        ],
        'read_only',
      ),
      makeInstance('read-only-instance'),
    );

    expect(verdict.allowed).toBe(true);
  });

  it('blocks write steps outside .organism', async () => {
    const repoPath = await makeTmpRepo();
    const verdict = await reviewActionPlan(
      repoPath,
      makeTemplate([
        {
          id: 'write-artifact',
          title: 'Write artifact',
          type: 'write_artifact',
          path: 'outside/stabilization.md',
          from: 'artifact',
        },
      ]),
      makeInstance('outside-write'),
    );

    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons.some((reason) => reason.code === 'write-root')).toBe(true);
  });
});

describe('runActionInstance', () => {
  it('executes steps in order and allows later steps to use earlier outputs', async () => {
    const repoPath = await makeTmpRepo();
    const result = await runActionInstance(
      repoPath,
      makeTemplate([
        {
          id: 'generate-artifact',
          title: 'Generate artifact',
          type: 'generate_artifact',
          format: 'markdown',
          template: 'artifact-template',
          produces: 'artifact',
        },
        {
          id: 'write-artifact',
          title: 'Write artifact',
          type: 'write_artifact',
          path: '.organism/actions/artifacts/test-artifact.md',
          from: 'artifact',
        },
      ]),
      makeInstance('ordered-success'),
    );

    expect(result.status).toBe('succeeded');
    expect(result.step_results.map((step) => step.step_id)).toEqual([
      'generate-artifact',
      'write-artifact',
    ]);

    const content = await fs.readFile(
      path.join(repoPath, '.organism', 'actions', 'artifacts', 'test-artifact.md'),
      'utf-8',
    );
    expect(content).toContain('# Runner Template');
  });

  it('stops on step failure', async () => {
    const repoPath = await makeTmpRepo();
    const result = await runActionInstance(
      repoPath,
      makeTemplate([
        {
          id: 'write-artifact',
          title: 'Write missing output',
          type: 'write_artifact',
          path: '.organism/actions/artifacts/missing.md',
          from: 'missing-output',
        },
        {
          id: 'record-event',
          title: 'Should never run',
          type: 'record_event',
          event_type: 'plan-created',
          summary: 'Should not execute',
        },
      ]),
      makeInstance('step-failure'),
    );

    expect(result.status).toBe('failed');
    expect(result.step_results).toHaveLength(1);
    expect(result.step_results[0]?.status).toBe('failed');
  });

  it('rejects read_only actions that declare write steps', async () => {
    const repoPath = await makeTmpRepo();
    const result = await runActionInstance(
      repoPath,
      makeTemplate(
        [
          {
            id: 'write-artifact',
            title: 'Illegal write',
            type: 'write_artifact',
            path: '.organism/actions/artifacts/illegal.md',
            from: 'artifact',
          },
        ],
        'read_only',
      ),
      makeInstance('read-only-rejection'),
    );

    expect(result.status).toBe('rejected');
    expect(result.failure_reason).toMatch(/read_only/i);
  });

  it('persists status transitions to action history', async () => {
    const repoPath = await makeTmpRepo();
    const result = await runActionInstance(
      repoPath,
      makeTemplate([
        {
          id: 'generate-artifact',
          title: 'Generate artifact',
          type: 'generate_artifact',
          format: 'markdown',
          template: 'artifact-template',
          produces: 'artifact',
        },
      ]),
      makeInstance('persisted-status'),
    );

    const saved = await loadActionInstance(repoPath, 'persisted-status');
    expect(result.status).toBe('succeeded');
    expect(saved?.status).toBe('succeeded');
    expect(saved?.completed_at).toBeDefined();
  });
});
