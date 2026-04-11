import fs from 'node:fs/promises';
import path from 'node:path';
import type { WriteArtifactStep } from '../types.js';
import type { StepExecutor } from './types.js';

export const writeArtifactStep: StepExecutor<WriteArtifactStep> = async ({
  repoPath,
  instance,
  step,
  stepOutputs,
}) => {
  const content = stepOutputs[step.from] ?? instance.bound_inputs[step.from];
  if (typeof content !== 'string') {
    throw new Error(`write_artifact could not resolve string content from "${step.from}"`);
  }

  const targetPath = path.resolve(repoPath, step.path);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf-8');
  return { output: targetPath };
};
