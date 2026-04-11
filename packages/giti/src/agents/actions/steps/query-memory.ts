import { queryMemory } from '../../memory/index.js';
import type { QueryMemoryStep } from '../types.js';
import type { StepExecutor } from './types.js';

export const queryMemoryStep: StepExecutor<QueryMemoryStep> = async ({ repoPath, step }) => {
  const result = await queryMemory(repoPath, step.query);
  return { output: result };
};
