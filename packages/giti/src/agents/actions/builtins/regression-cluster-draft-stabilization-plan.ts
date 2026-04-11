import type { ActionTemplate } from '../types.js';

export const regressionClusterDraftStabilizationPlan: ActionTemplate = {
  id: 'regression-cluster-draft-stabilization-plan',
  name: 'Regression Cluster Draft Stabilization Plan',
  version: 1,
  status: 'active',
  intent: 'Draft a stabilization plan when regression pressure rises.',
  description: 'Produces a low-risk stabilization artifact and records a corresponding organism event.',
  triggers: [
    {
      type: 'metric_lt',
      metric: 'quality.test_pass_rate',
      value: 0.99,
    },
  ],
  inputs: [
    {
      name: 'state_report',
      source: 'state_report',
      required: true,
    },
    {
      name: 'memory',
      source: 'memory',
      required: true,
    },
  ],
  constraints: [
    {
      type: 'allowed_write_root',
      root: '.organism/actions/artifacts',
    },
  ],
  risk: 'low',
  effects: ['writes_files', 'records_memory'],
  steps: [
    {
      id: 'read-state',
      title: 'Read current repository state',
      type: 'read_repo_state',
      produces: 'current_state',
    },
    {
      id: 'query-memory',
      title: 'Query memory for fragile files and regressions',
      type: 'query_memory',
      query: 'fragile regressions stabilization',
      produces: 'memory_matches',
    },
    {
      id: 'confirm-regression-pressure',
      title: 'Confirm regression pressure is active',
      type: 'evaluate_predicate',
      predicate: {
        type: 'metric_lt',
        metric: 'quality.test_pass_rate',
        value: 0.99,
      },
      produces: 'regression_pressure_confirmed',
    },
    {
      id: 'select-targets',
      title: 'Select stabilization targets',
      type: 'select_targets',
      source: 'memory_matches.results',
      limit: 5,
      produces: 'selected_targets',
    },
    {
      id: 'generate-artifact',
      title: 'Generate stabilization artifact',
      type: 'generate_artifact',
      format: 'markdown',
      template: 'stabilization-plan',
      produces: 'artifact',
    },
    {
      id: 'write-artifact',
      title: 'Write stabilization artifact',
      type: 'write_artifact',
      path: '.organism/actions/artifacts/stabilization-plan.md',
      from: 'artifact',
    },
    {
      id: 'record-event',
      title: 'Record stabilization planning event',
      type: 'record_event',
      event_type: 'plan-created',
      summary: 'Drafted a stabilization plan from the declarative action engine',
      data_from: 'selected_targets',
    },
    {
      id: 'record-lesson',
      title: 'Record stabilization lesson',
      type: 'record_lesson',
      category: 'regressions',
      lesson_from: 'artifact',
      confidence: 0.82,
    },
  ],
  success_criteria: [
    {
      type: 'artifact_written',
      path: '.organism/actions/artifacts/stabilization-plan.md',
    },
    {
      type: 'event_recorded',
      event_type: 'plan-created',
    },
  ],
  learning_hooks: [
    {
      type: 'record_event',
    },
    {
      type: 'record_lesson',
      category: 'regressions',
    },
  ],
  provenance: {
    source: 'built_in',
    created_at: '2026-04-10T00:00:00.000Z',
    updated_at: '2026-04-10T00:00:00.000Z',
  },
};
