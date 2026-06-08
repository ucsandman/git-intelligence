import type { ActionTemplate } from '../types.js';

export const commandOutputEvidenceCapture: ActionTemplate = {
  id: 'command-output-evidence-capture',
  name: 'Command Output Evidence Capture',
  version: 1,
  status: 'active',
  intent: 'Capture focused command-output evidence when quality checks fail.',
  description: 'Writes a low-risk action artifact summarizing failing lint or test evidence for later repair.',
  triggers: [
    {
      type: 'metric_gt',
      metric: 'quality.lint_error_count',
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
  constraints: [
    {
      type: 'allowed_write_root',
      root: '.organism/actions/artifacts',
    },
    {
      type: 'predicate',
      predicate: {
        type: 'cooldown_inactive',
      },
    },
  ],
  risk: 'low',
  effects: ['writes_files'],
  steps: [
    {
      id: 'read-state',
      title: 'Read failing quality signals',
      type: 'read_repo_state',
      include: [
        'quality.lint_error_count',
        'quality.test_pass_rate',
        'quality.files_exceeding_length_limit',
        'anomalies',
      ],
      produces: 'quality_state',
    },
    {
      id: 'confirm-lint-pressure',
      title: 'Confirm lint failure pressure is active',
      type: 'evaluate_predicate',
      predicate: {
        type: 'metric_gt',
        metric: 'quality.lint_error_count',
        value: 0,
      },
      produces: 'lint_pressure_confirmed',
    },
    {
      id: 'generate-evidence',
      title: 'Generate command evidence artifact',
      type: 'generate_artifact',
      format: 'markdown',
      template: 'command-output-evidence-capture',
      produces: 'artifact',
    },
    {
      id: 'write-evidence',
      title: 'Write command evidence artifact',
      type: 'write_artifact',
      path: '.organism/actions/artifacts/command-output-evidence.md',
      from: 'artifact',
    },
  ],
  success_criteria: [
    {
      type: 'artifact_written',
      path: '.organism/actions/artifacts/command-output-evidence.md',
    },
  ],
  rollback_strategy: {
    strategy: 'delete_artifact',
    description: 'Delete the generated evidence artifact if the action is reverted.',
  },
  learning_hooks: [],
  provenance: {
    source: 'built_in',
    created_at: '2026-06-08T00:00:00.000Z',
    updated_at: '2026-06-08T00:00:00.000Z',
  },
};
