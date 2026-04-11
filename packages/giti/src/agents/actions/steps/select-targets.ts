import type { SelectTargetsStep } from '../types.js';
import type { StepExecutor } from './types.js';

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export const selectTargetsStep: StepExecutor<SelectTargetsStep> = async ({
  instance,
  step,
  stepOutputs,
}) => {
  const source = stepOutputs[step.source] ?? instance.bound_inputs[step.source] ?? [];
  const selected = toArray(source).slice(0, step.limit ?? undefined);
  return { output: selected };
};
