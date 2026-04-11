import type { SelectTargetsStep } from '../types.js';
import type { StepExecutor } from './types.js';

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function resolvePath(source: string, values: Record<string, unknown>): unknown {
  const segments = source.split('.');
  const [first, ...rest] = segments;
  if (!first) {
    return undefined;
  }

  return rest.reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, values[first]);
}

export const selectTargetsStep: StepExecutor<SelectTargetsStep> = async ({
  instance,
  step,
  stepOutputs,
}) => {
  const source =
    resolvePath(step.source, stepOutputs) ??
    resolvePath(step.source, instance.bound_inputs) ??
    [];
  const selected = toArray(source).slice(0, step.limit ?? undefined);
  return { output: selected };
};
