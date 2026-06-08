import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeActions } from '../../src/cli/actions.js';
import { saveActionInstance } from '../../src/agents/actions/history.js';
import type { ActionInstance } from '../../src/agents/actions/types.js';

function makeInstance(overrides: Partial<ActionInstance> = {}): ActionInstance {
  return {
    id: 'action-1',
    template_id: 'command-output-evidence-capture',
    template_version: 1,
    status: 'succeeded',
    bound_inputs: {
      repo_path: '/repo',
    },
    started_at: '2026-06-08T13:40:00.000Z',
    completed_at: '2026-06-08T13:41:00.000Z',
    step_results: [
      {
        step_id: 'read-state',
        step_type: 'read_repo_state',
        status: 'succeeded',
      },
      {
        step_id: 'write-evidence',
        step_type: 'write_artifact',
        status: 'succeeded',
        output: {
          path: '.organism/actions/artifacts/command-output-evidence.md',
        },
      },
    ],
    ...overrides,
  };
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(path.relative(root, fullPath).replace(/\\/g, '/'));
      }
    }
  }

  await walk(root);
  return files.sort();
}

describe('actions CLI', () => {
  let tmp: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-actions-cli-'));
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit ${code}`);
    }) as never);
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('prints an empty formatted action list without mutating history', async () => {
    const before = await listFiles(tmp);

    await executeActions('list', undefined, { path: tmp });

    const after = await listFiles(tmp);
    expect(after).toEqual(before);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('No action history found'));
  });

  it('lists recent action instances with status, risk, timestamps, and artifacts', async () => {
    await saveActionInstance(tmp, makeInstance());

    await executeActions('list', undefined, { path: tmp });

    const output = String(stdoutSpy.mock.calls[0]?.[0]);
    expect(output).toContain('action-1');
    expect(output).toContain('command-output-evidence-capture');
    expect(output).toContain('succeeded');
    expect(output).toContain('low');
    expect(output).toContain('2026-06-08T13:40:00.000Z');
    expect(output).toContain('.organism/actions/artifacts/command-output-evidence.md');
  });

  it('shows one action with steps, failure reason, and success criteria', async () => {
    await saveActionInstance(tmp, makeInstance({
      status: 'failed',
      failure_reason: 'Artifact renderer failed',
    }));

    await executeActions('show', 'action-1', { path: tmp });

    const output = String(stdoutSpy.mock.calls[0]?.[0]);
    expect(output).toContain('Action action-1');
    expect(output).toContain('Failure reason: Artifact renderer failed');
    expect(output).toContain('write-evidence');
    expect(output).toContain('Success criteria:');
    expect(output).toContain('artifact_written');
  });

  it('prints stable JSON output for list and show', async () => {
    await saveActionInstance(tmp, makeInstance());

    await executeActions('list', undefined, { path: tmp, json: true });
    await executeActions('show', 'action-1', { path: tmp, json: true });

    const listPayload = JSON.parse(String(stdoutSpy.mock.calls[0]?.[0])) as { actions: Array<Record<string, unknown>> };
    const showPayload = JSON.parse(String(stdoutSpy.mock.calls[1]?.[0])) as Record<string, unknown>;
    expect(Object.keys(listPayload.actions[0] ?? {})).toEqual([
      'id',
      'template_id',
      'status',
      'risk',
      'created_at',
      'updated_at',
      'artifact_paths',
    ]);
    expect(showPayload).toHaveProperty('action');
    expect(showPayload).toHaveProperty('steps');
    expect(showPayload).toHaveProperty('success_criteria');
  });

  it('reports missing action ids as errors', async () => {
    await expect(executeActions('show', 'missing', { path: tmp })).rejects.toThrow('process.exit 1');

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Action not found: missing'));
  });

  it('does not mutate action history while inspecting non-empty history', async () => {
    await saveActionInstance(tmp, makeInstance());
    const before = await listFiles(tmp);

    await executeActions('list', undefined, { path: tmp });
    await executeActions('show', 'action-1', { path: tmp });

    const after = await listFiles(tmp);
    expect(after).toEqual(before);
  });
});
