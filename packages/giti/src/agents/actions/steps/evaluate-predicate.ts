import { evaluatePredicate } from '../predicates.js';
import type { EvaluatePredicateStep } from '../types.js';
import type { StepExecutor } from './types.js';

export const evaluatePredicateStep: StepExecutor<EvaluatePredicateStep> = async ({
  instance,
  step,
}) => {
  const passed = evaluatePredicate(step.predicate, {
    repo_path:
      typeof instance.bound_inputs.repo_path === 'string' ? instance.bound_inputs.repo_path : '',
    state_report:
      typeof instance.bound_inputs.state_report === 'object' &&
      instance.bound_inputs.state_report !== null
        ? (instance.bound_inputs.state_report as Record<string, unknown>)
        : {},
    memory:
      typeof instance.bound_inputs.memory === 'object' && instance.bound_inputs.memory !== null
        ? (instance.bound_inputs.memory as Record<string, unknown>)
        : {},
    config:
      typeof instance.bound_inputs.config === 'object' && instance.bound_inputs.config !== null
        ? (instance.bound_inputs.config as Record<string, unknown>)
        : {},
    runtime:
      typeof instance.bound_inputs.runtime === 'object' && instance.bound_inputs.runtime !== null
        ? (instance.bound_inputs.runtime as Record<string, unknown>)
        : {},
  });

  return { output: passed };
};
