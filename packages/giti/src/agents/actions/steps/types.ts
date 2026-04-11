import type { ActionInstance, ActionStep, ActionTemplate } from '../types.js';

export interface StepExecutorContext<TStep extends ActionStep = ActionStep> {
  repoPath: string;
  template: ActionTemplate;
  instance: ActionInstance;
  step: TStep;
  stepOutputs: Record<string, unknown>;
}

export interface StepExecutorResult {
  output?: unknown;
}

export type StepExecutor<TStep extends ActionStep = ActionStep> = (
  context: StepExecutorContext<TStep>,
) => Promise<StepExecutorResult>;
