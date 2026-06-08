import chalk from 'chalk';
import { getActionTemplate } from '../agents/actions/registry.js';
import { listActionInstances, loadActionInstance } from '../agents/actions/history.js';
import type {
  ActionInstance,
  ActionRisk,
  ActionStep,
  ActionTemplate,
  StepExecutionResult,
  SuccessCriterion,
} from '../agents/actions/types.js';

interface ActionSummaryView {
  id: string;
  template_id: string;
  status: ActionInstance['status'];
  risk: ActionRisk | 'unknown';
  created_at: string;
  updated_at: string;
  artifact_paths: string[];
}

interface ActionStepView {
  id: string;
  type: string;
  status: StepExecutionResult['status'] | 'pending';
  error?: string;
}

interface SuccessCriterionView {
  type: SuccessCriterion['type'];
  target: string;
  status: 'passed' | 'failed' | 'pending';
}

interface ActionDetailView {
  action: ActionSummaryView & {
    template_version: number;
    failure_reason?: string;
  };
  steps: ActionStepView[];
  success_criteria: SuccessCriterionView[];
}

interface ExecuteActionsOptions {
  path?: string;
  json?: boolean;
  limit?: string;
}

export async function executeActions(
  subcommand: string,
  id: string | undefined,
  options: ExecuteActionsOptions,
): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  try {
    switch (subcommand) {
      case 'list': {
        const limit = options.limit ? parseInt(options.limit, 10) : 10;
        const instances = await listActionInstances(repoPath, Number.isFinite(limit) ? limit : 10);
        const summaries = instances.map(toSummaryView);
        if (options.json) {
          writeStdout({ actions: summaries });
        } else {
          writeText(formatActionList(summaries));
        }
        return;
      }
      case 'show': {
        if (!id) {
          fail('Action id is required for `giti actions show <id>`');
          return;
        }
        const instance = await loadActionInstance(repoPath, id);
        if (!instance) {
          fail(`Action not found: ${id}`);
          return;
        }
        const detail = toDetailView(instance);
        if (options.json) {
          writeStdout(detail);
        } else {
          writeText(formatActionDetail(detail));
        }
        return;
      }
      default:
        fail(`Unknown actions subcommand: ${subcommand}. Use: list, show`);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Unknown actions error');
  }
}

function toSummaryView(instance: ActionInstance): ActionSummaryView {
  const template = getActionTemplate(instance.template_id);
  return {
    id: instance.id,
    template_id: instance.template_id,
    status: instance.status,
    risk: template?.risk ?? 'unknown',
    created_at: instance.started_at ?? instance.completed_at ?? 'unknown',
    updated_at: instance.completed_at ?? instance.started_at ?? 'unknown',
    artifact_paths: getArtifactPaths(instance, template),
  };
}

function toDetailView(instance: ActionInstance): ActionDetailView {
  const template = getActionTemplate(instance.template_id);
  return {
    action: {
      ...toSummaryView(instance),
      template_version: instance.template_version,
      failure_reason: instance.failure_reason,
    },
    steps: getStepViews(instance, template),
    success_criteria: getSuccessCriteriaViews(instance, template),
  };
}

function getArtifactPaths(instance: ActionInstance, template: ActionTemplate | null): string[] {
  const paths = new Set<string>();

  for (const step of template?.steps ?? []) {
    if (step.type === 'write_artifact') {
      paths.add(step.path);
    }
  }

  for (const result of instance.step_results) {
    const output = result.output;
    if (isRecord(output) && typeof output.path === 'string') {
      paths.add(output.path);
    }
  }

  return Array.from(paths).sort();
}

function getStepViews(instance: ActionInstance, template: ActionTemplate | null): ActionStepView[] {
  const resultsById = new Map(instance.step_results.map((result) => [result.step_id, result]));
  const templateSteps = template?.steps ?? [];

  if (templateSteps.length === 0) {
    return instance.step_results.map((result) => ({
      id: result.step_id,
      type: result.step_type,
      status: result.status,
      error: result.error,
    }));
  }

  return templateSteps.map((step: ActionStep) => {
    const result = resultsById.get(step.id);
    return {
      id: step.id,
      type: step.type,
      status: result?.status ?? 'pending',
      error: result?.error,
    };
  });
}

function getSuccessCriteriaViews(
  instance: ActionInstance,
  template: ActionTemplate | null,
): SuccessCriterionView[] {
  const status = instance.status === 'succeeded'
    ? 'passed'
    : instance.status === 'failed'
      ? 'failed'
      : 'pending';

  return (template?.success_criteria ?? []).map((criterion) => ({
    type: criterion.type,
    target: describeSuccessCriterion(criterion),
    status,
  }));
}

function describeSuccessCriterion(criterion: SuccessCriterion): string {
  switch (criterion.type) {
    case 'artifact_written':
      return criterion.path;
    case 'event_recorded':
      return criterion.event_type;
    case 'predicate':
      return criterion.predicate.type;
  }
}

function formatActionList(actions: ActionSummaryView[]): string {
  if (actions.length === 0) {
    return 'No action history found. Run `giti cycle` to create action instances.';
  }

  const lines = [chalk.bold(`Action history (${actions.length})`), chalk.dim('----------------')];
  for (const action of actions) {
    lines.push(`${action.id}  ${action.template_id}  ${action.status}  risk:${action.risk}`);
    lines.push(`  created: ${action.created_at}  updated: ${action.updated_at}`);
    lines.push(`  artifacts: ${action.artifact_paths.length > 0 ? action.artifact_paths.join(', ') : 'none'}`);
  }
  return lines.join('\n');
}

function formatActionDetail(detail: ActionDetailView): string {
  const lines = [
    chalk.bold(`Action ${detail.action.id}`),
    chalk.dim('----------'),
    `Template: ${detail.action.template_id}@${detail.action.template_version}`,
    `Status: ${detail.action.status}`,
    `Risk: ${detail.action.risk}`,
    `Created: ${detail.action.created_at}`,
    `Updated: ${detail.action.updated_at}`,
    `Artifacts: ${detail.action.artifact_paths.length > 0 ? detail.action.artifact_paths.join(', ') : 'none'}`,
  ];

  if (detail.action.failure_reason) {
    lines.push(`Failure reason: ${detail.action.failure_reason}`);
  }

  lines.push('', 'Steps:');
  for (const step of detail.steps) {
    lines.push(`  - ${step.id} (${step.type}): ${step.status}${step.error ? ` - ${step.error}` : ''}`);
  }

  lines.push('', 'Success criteria:');
  if (detail.success_criteria.length === 0) {
    lines.push('  - none');
  } else {
    for (const criterion of detail.success_criteria) {
      lines.push(`  - ${criterion.type}: ${criterion.target} - ${criterion.status}`);
    }
  }

  return lines.join('\n');
}

function writeStdout(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeText(value: string): void {
  process.stdout.write(`${value}\n`);
}

function fail(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
