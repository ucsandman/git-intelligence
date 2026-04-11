import { describe, expect, it } from 'vitest';
import {
  assertActionInstance,
  assertActionTemplate,
  validateActionTemplate,
} from '../../../src/agents/actions/schema.js';

function makeValidTemplate() {
  return {
    id: 'regression-cluster-draft-stabilization-plan',
    name: 'Regression Cluster Stabilization',
    version: 1,
    status: 'active',
    intent: 'Draft a stabilization artifact when regression pressure rises.',
    description: 'Generates a low-risk stabilization plan from current organism state.',
    triggers: [
      {
        type: 'metric_gt',
        metric: 'quality.test_failures',
        value: 0,
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
    effects: ['writes_files', 'records_memory'],
    steps: [
      {
        id: 'read-state',
        title: 'Read current repository state',
        type: 'read_repo_state',
      },
      {
        id: 'write-artifact',
        title: 'Write stabilization artifact',
        type: 'write_artifact',
        path: '.organism/actions/artifacts/stabilization.md',
        from: 'artifact',
      },
    ],
    success_criteria: [
      {
        type: 'artifact_written',
        path: '.organism/actions/artifacts/stabilization.md',
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

describe('validateActionTemplate', () => {
  it('accepts a valid action template', () => {
    const template = makeValidTemplate();

    expect(assertActionTemplate(template)).toEqual(template);
    expect(validateActionTemplate(template)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects invalid risk values', () => {
    const result = validateActionTemplate({
      ...makeValidTemplate(),
      risk: 'danger',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/risk/i);
  });

  it('rejects read_only templates with write effects', () => {
    expect(() =>
      assertActionTemplate({
        ...makeValidTemplate(),
        risk: 'read_only',
        effects: ['writes_files'],
      }),
    ).toThrow(/read_only/i);
  });

  it('rejects unknown step types', () => {
    expect(() =>
      assertActionTemplate({
        ...makeValidTemplate(),
        steps: [
          {
            id: 'unknown',
            title: 'Do the unsupported thing',
            type: 'invented_step',
          },
        ],
      }),
    ).toThrow(/step/i);
  });
});

describe('assertActionInstance', () => {
  it('accepts a valid action instance', () => {
    const instance = {
      id: 'instance-1',
      template_id: 'regression-cluster-draft-stabilization-plan',
      template_version: 1,
      status: 'planned',
      bound_inputs: {
        repo_path: '/repo',
      },
      step_results: [],
    };

    expect(assertActionInstance(instance)).toEqual(instance);
  });

  it('rejects unknown instance statuses', () => {
    expect(() =>
      assertActionInstance({
        id: 'instance-2',
        template_id: 'regression-cluster-draft-stabilization-plan',
        template_version: 1,
        status: 'queued',
        bound_inputs: {},
        step_results: [],
      }),
    ).toThrow(/status/i);
  });
});
