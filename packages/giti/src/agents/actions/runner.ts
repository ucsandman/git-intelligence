import { saveActionInstance, updateActionInstanceStatus } from './history.js';
import { getStepExecutor } from './steps/index.js';
import { reviewActionPlan } from '../immune-system/index.js';
import type { ActionInstance, ActionTemplate, StepExecutionResult } from './types.js';

const WRITE_STEP_TYPES = new Set(['write_artifact', 'create_git_branch', 'open_github_issue']);

function hasWriteStep(template: ActionTemplate): boolean {
  return template.steps.some((step) => WRITE_STEP_TYPES.has(step.type));
}

export async function runActionInstance(
  repoPath: string,
  template: ActionTemplate,
  instance: ActionInstance,
): Promise<ActionInstance> {
  let current = await saveActionInstance(repoPath, instance);

  if (template.risk === 'read_only' && hasWriteStep(template)) {
    current = await updateActionInstanceStatus(repoPath, current.id, {
      status: 'rejected',
      completed_at: new Date().toISOString(),
      failure_reason: 'read_only actions cannot include write-capable steps',
    });
    return current;
  }

  const verdict = await reviewActionPlan(repoPath, template, current);
  if (!verdict.allowed) {
    current = await updateActionInstanceStatus(repoPath, current.id, {
      status: 'rejected',
      completed_at: new Date().toISOString(),
      failure_reason: verdict.reasons.map((reason) => reason.message).join('; '),
    });
    return current;
  }

  current = await updateActionInstanceStatus(repoPath, current.id, {
    status: 'approved',
    started_at: new Date().toISOString(),
  });

  const stepOutputs: Record<string, unknown> = {};
  const stepResults: StepExecutionResult[] = [];

  current = await updateActionInstanceStatus(repoPath, current.id, {
    status: 'running',
  });

  for (const step of template.steps) {
    const startedAt = new Date().toISOString();
    const executor = getStepExecutor(step.type);

    if (!executor) {
      stepResults.push({
        step_id: step.id,
        step_type: step.type,
        status: 'failed',
        error: `No executor registered for step type "${step.type}"`,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
      current = await updateActionInstanceStatus(repoPath, current.id, {
        status: 'failed',
        step_results: stepResults,
        completed_at: new Date().toISOString(),
        failure_reason: `No executor registered for step type "${step.type}"`,
      } as Partial<ActionInstance>);
      return current;
    }

    try {
      const result = await executor({
        repoPath,
        template,
        instance: current,
        step,
        stepOutputs,
      });

      if (step.produces !== undefined) {
        stepOutputs[step.produces] = result.output;
      }

      stepResults.push({
        step_id: step.id,
        step_type: step.type,
        status: 'succeeded',
        output: result.output,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      stepResults.push({
        step_id: step.id,
        step_type: step.type,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
      current = await updateActionInstanceStatus(repoPath, current.id, {
        status: 'failed',
        step_results: stepResults,
        completed_at: new Date().toISOString(),
        failure_reason: error instanceof Error ? error.message : String(error),
      } as Partial<ActionInstance>);
      return current;
    }
  }

  current = await updateActionInstanceStatus(repoPath, current.id, {
    status: 'succeeded',
    step_results: stepResults,
    completed_at: new Date().toISOString(),
  } as Partial<ActionInstance>);
  return current;
}
