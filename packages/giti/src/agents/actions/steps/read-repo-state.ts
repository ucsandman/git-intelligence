import type { ReadRepoStateStep } from '../types.js';
import type { StepExecutor } from './types.js';

export const readRepoStateStep: StepExecutor<ReadRepoStateStep> = async ({ instance }) => {
  return {
    output: instance.bound_inputs.state_report ?? instance.bound_inputs,
  };
};
