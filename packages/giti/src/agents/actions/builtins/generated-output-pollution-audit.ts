import type { ActionTemplate } from '../types.js';

export const generatedOutputPollutionAudit: ActionTemplate = {
  id: 'generated-output-pollution-audit',
  name: 'Generated Output Pollution Audit',
  version: 1,
  status: 'active',
  intent: 'Diagnose whether generated artifacts are distorting organism quality signals.',
  description: 'Read-only triage for suspiciously large codebase metrics that may be caused by build output.',
  triggers: [
    {
      type: 'metric_gt',
      metric: 'codebase.avg_file_length',
      value: 300,
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
      type: 'predicate',
      predicate: {
        type: 'cooldown_inactive',
      },
    },
  ],
  risk: 'read_only',
  effects: [],
  steps: [
    {
      id: 'read-state',
      title: 'Read current quality and codebase metrics',
      type: 'read_repo_state',
      include: [
        'quality.files_exceeding_length_limit',
        'quality.functions_exceeding_complexity',
        'codebase.largest_files',
        'codebase.file_type_distribution',
      ],
      produces: 'current_state',
    },
    {
      id: 'confirm-large-file-pressure',
      title: 'Confirm codebase length pressure is active',
      type: 'evaluate_predicate',
      predicate: {
        type: 'metric_gt',
        metric: 'codebase.avg_file_length',
        value: 300,
      },
      produces: 'large_file_pressure_confirmed',
    },
    {
      id: 'draft-audit',
      title: 'Draft generated-output pollution audit',
      type: 'generate_artifact',
      format: 'markdown',
      template: 'generated-output-pollution-audit',
      produces: 'audit',
    },
  ],
  success_criteria: [
    {
      type: 'predicate',
      predicate: {
        type: 'metric_gt',
        metric: 'codebase.avg_file_length',
        value: 300,
      },
    },
  ],
  rollback_strategy: {
    strategy: 'none',
    description: 'Read-only audit has no persistent side effects.',
  },
  learning_hooks: [],
  provenance: {
    source: 'built_in',
    created_at: '2026-06-08T00:00:00.000Z',
    updated_at: '2026-06-08T00:00:00.000Z',
  },
};
