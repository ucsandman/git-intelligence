import type { GenerateArtifactStep } from '../types.js';
import type { StepExecutor } from './types.js';

export const generateArtifactStep: StepExecutor<GenerateArtifactStep> = async ({
  template,
  instance,
}) => {
  const artifact = [
    `# ${template.name}`,
    '',
    `Template: ${template.id}@${template.version}`,
    '',
    '## Bound Inputs',
    '```json',
    JSON.stringify(instance.bound_inputs, null, 2),
    '```',
  ].join('\n');

  return { output: artifact };
};
