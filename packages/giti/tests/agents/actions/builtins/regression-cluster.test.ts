import { describe, expect, it } from 'vitest';
import { assertActionTemplate } from '../../../../src/agents/actions/schema.js';
import { builtInActionTemplates } from '../../../../src/agents/actions/builtins/index.js';
import { commandOutputEvidenceCapture } from '../../../../src/agents/actions/builtins/command-output-evidence-capture.js';
import { generatedOutputPollutionAudit } from '../../../../src/agents/actions/builtins/generated-output-pollution-audit.js';
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

describe('additional self-healing built-ins', () => {
  it('registers generated-output and command-output templates as active built-ins', () => {
    expect(builtInActionTemplates.map((template) => template.id)).toEqual(
      expect.arrayContaining([
        'generated-output-pollution-audit',
        'command-output-evidence-capture',
      ]),
    );
    expect(generatedOutputPollutionAudit.status).toBe('active');
    expect(commandOutputEvidenceCapture.status).toBe('active');
  });

  it('validates the generated-output pollution audit as read-only', () => {
    expect(() => assertActionTemplate(generatedOutputPollutionAudit)).not.toThrow();
    expect(generatedOutputPollutionAudit.risk).toBe('read_only');
    expect(generatedOutputPollutionAudit.effects).toEqual([]);
    expect(generatedOutputPollutionAudit.steps.map((step) => step.type)).not.toContain('write_artifact');
  });

  it('validates command-output evidence capture as low-risk artifact writing', () => {
    expect(() => assertActionTemplate(commandOutputEvidenceCapture)).not.toThrow();
    expect(commandOutputEvidenceCapture.risk).toBe('low');
    expect(commandOutputEvidenceCapture.effects).toEqual(['writes_files']);

    const writeSteps = commandOutputEvidenceCapture.steps.filter((step) => step.type === 'write_artifact');
    expect(writeSteps).toHaveLength(1);
    const [writeStep] = writeSteps;
    if (writeStep?.type !== 'write_artifact') {
      throw new Error('expected write_artifact step');
    }
    expect(writeStep.path).toMatch(/^\.organism\/actions\/artifacts\//);
  });
});
