import { describe, expect, it } from 'vitest';
import { assertActionTemplate } from '../../../../src/agents/actions/schema.js';
import { regressionClusterDraftStabilizationPlan } from '../../../../src/agents/actions/builtins/regression-cluster-draft-stabilization-plan.js';

describe('regressionClusterDraftStabilizationPlan', () => {
  it('validates as a supported low-risk template', () => {
    expect(() => assertActionTemplate(regressionClusterDraftStabilizationPlan)).not.toThrow();
    expect(regressionClusterDraftStabilizationPlan.risk).toBe('low');
    expect(regressionClusterDraftStabilizationPlan.effects).toEqual(
      expect.arrayContaining(['writes_files', 'records_memory']),
    );
  });

  it('uses the full low-risk stabilization workflow', () => {
    expect(
      regressionClusterDraftStabilizationPlan.steps.map((step) => step.type),
    ).toEqual([
      'read_repo_state',
      'query_memory',
      'evaluate_predicate',
      'select_targets',
      'generate_artifact',
      'write_artifact',
      'record_event',
      'record_lesson',
    ]);
  });

  it('writes its artifact under the action artifact root', () => {
    const writeStep = regressionClusterDraftStabilizationPlan.steps.find(
      (step) => step.type === 'write_artifact',
    );

    expect(writeStep).toBeDefined();
    expect(writeStep?.type).toBe('write_artifact');
    if (writeStep?.type !== 'write_artifact') {
      throw new Error('expected write_artifact step');
    }

    expect(writeStep.path).toMatch(/^\.organism\/actions\/artifacts\//);
  });
});
