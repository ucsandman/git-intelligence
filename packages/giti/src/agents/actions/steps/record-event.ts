import { recordMemoryEvent } from '../../memory/index.js';
import type { EventType } from '../../types.js';
import type { RecordEventStep } from '../types.js';
import type { StepExecutor } from './types.js';

export const recordEventStep: StepExecutor<RecordEventStep> = async ({
  repoPath,
  instance,
  step,
  stepOutputs,
}) => {
  const data = step.data_from
    ? stepOutputs[step.data_from] ?? instance.bound_inputs[step.data_from]
    : undefined;

  await recordMemoryEvent(
    repoPath,
    step.event_type as EventType,
    step.summary,
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : undefined,
  );

  return { output: { event_type: step.event_type } };
};
