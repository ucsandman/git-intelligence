import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildDoctorDiagnosis } from '../../src/agents/doctor/index.js';
import { formatDoctorDiagnosis } from '../../src/agents/doctor/formatter.js';
import { executeDoctor } from '../../src/cli/doctor.js';
import type { StateReport } from '../../src/agents/sensory-cortex/types.js';
import type { CyclePlan } from '../../src/agents/prefrontal-cortex/types.js';

function makeStateReport(overrides: Partial<StateReport> = {}): StateReport {
  return {
    timestamp: '2026-06-08T13:30:00.000Z',
    version: '0.1.0',
    git: {
      total_commits: 12,
      commits_last_7d: 3,
      commits_last_30d: 9,
      unique_authors_30d: 1,
      active_branches: 2,
      stale_branches: 0,
      last_commit_age_hours: 4,
      avg_commit_size_lines: 28,
    },
    quality: {
      test_file_count: 6,
      source_file_count: 10,
      test_ratio: 0.6,
      test_pass_rate: 0.9,
      test_coverage_percent: 74,
      lint_error_count: 2,
      files_exceeding_length_limit: ['.next/server/app.js'],
      functions_exceeding_complexity: [],
    },
    performance: {
      pulse_execution_ms: 120,
      hotspots_execution_ms: 300,
      ghosts_execution_ms: 220,
      benchmarked_against: 'fixture',
    },
    dependencies: {
      total_count: 20,
      outdated_count: 1,
      vulnerable_count: 0,
      outdated_packages: [],
      vulnerabilities: [],
    },
    codebase: {
      total_files: 16,
      total_lines: 1200,
      avg_file_length: 75,
      largest_files: [{ path: '.next/static/chunk.js', lines: 500 }],
      file_type_distribution: { '.ts': 10, '.js': 6 },
    },
    anomalies: [{ type: 'quality_regression', severity: 'warning', message: 'Lint errors increased' }],
    growth_signals: [],
    ...overrides,
  };
}

function makeCyclePlan(): CyclePlan {
  return {
    cycle_number: 7,
    timestamp: '2026-06-08T13:35:00.000Z',
    state_report_id: '2026-06-08T13-30-00.000Z',
    selected_items: [
      {
        id: 'fix-lint',
        tier: 1,
        priority_score: 92,
        title: 'Fix lint regressions',
        description: 'Repair failing type checks.',
        rationale: 'The latest state report has lint errors.',
        target_files: ['src/index.ts'],
        estimated_complexity: 'small',
        memory_context: [],
        success_criteria: ['lint exits 0'],
        created_by: 'prefrontal-cortex',
        status: 'planned',
      },
    ],
    deferred_items: [],
    rationale: 'Fix the highest risk quality issue first.',
    estimated_risk: 'medium',
    memory_consulted: false,
    action_recommendations: [
      {
        template_id: 'generated-output-triage',
        template_version: 1,
        score: 81,
        rationale: ['Generated output appears in quality signals.'],
        risk: 'read_only',
      },
    ],
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
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

describe('doctor diagnosis', () => {
  let tmp: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-doctor-'));
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns stable JSON fields for a populated organism state', async () => {
    await writeJson(path.join(tmp, '.organism', 'state-reports', 'latest.json'), makeStateReport());
    await writeJson(path.join(tmp, '.organism', 'backlog', 'cycle-plan-latest.json'), makeCyclePlan());
    await writeJson(path.join(tmp, '.organism', 'consecutive-failures.json'), { count: 1 });

    const diagnosis = await buildDoctorDiagnosis(tmp);

    expect(Object.keys(diagnosis)).toEqual([
      'health',
      'signals',
      'next_action',
      'safety',
      'recommendations',
    ]);
    expect(diagnosis.health.current_state).toBe('stopped');
    expect(diagnosis.signals).toHaveLength(3);
    expect(diagnosis.signals[0]?.label).toBe('generated output pollution');
    expect(diagnosis.next_action.command).toBe('giti build fix-lint');
    expect(diagnosis.safety.read_only).toBe(true);
    expect(diagnosis.recommendations[0]).toMatchObject({
      title: 'Fix lint regressions',
      command: 'giti build fix-lint',
    });
  });

  it('formats current state, top signals, top recommendation, safety gates, and next command', async () => {
    const diagnosis = await buildDoctorDiagnosis(tmp, {
      report: makeStateReport(),
      plan: makeCyclePlan(),
      status: {
        state: 'running',
        last_cycle: null,
        next_cycle_at: null,
        total_cycles: 7,
        total_changes_merged: 2,
        total_changes_rejected: 1,
        total_api_tokens: 1200,
        api_budget: 5000,
        cooldown_until: null,
        consecutive_failures: 0,
      },
    });

    const formatted = formatDoctorDiagnosis(diagnosis);

    expect(formatted).toContain('Current state: running');
    expect(formatted).toContain('Top signals:');
    expect(formatted).toContain('generated output pollution');
    expect(formatted).toContain('Top recommendation: Fix lint regressions');
    expect(formatted).toContain('Safety gates:');
    expect(formatted).toContain('Next command: giti build fix-lint');
  });

  it('returns a bootstrap diagnosis when .organism state is missing', async () => {
    const diagnosis = await buildDoctorDiagnosis(tmp);

    expect(diagnosis.health.status).toBe('bootstrap');
    expect(diagnosis.health.summary).toContain('No organism state reports found');
    expect(diagnosis.next_action.command).toBe('giti sense');
    expect(diagnosis.recommendations[0]?.command).toBe('giti sense');
  });

  it('does not write files when running the default formatted command', async () => {
    await writeJson(path.join(tmp, '.organism', 'state-reports', 'latest.json'), makeStateReport());
    await writeJson(path.join(tmp, '.organism', 'backlog', 'cycle-plan-latest.json'), makeCyclePlan());
    const before = await listFiles(tmp);

    await executeDoctor({ path: tmp });

    const after = await listFiles(tmp);
    expect(after).toEqual(before);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Current state: stopped\n'));
  });

  it('prints JSON output with the expected top-level shape', async () => {
    await writeJson(path.join(tmp, '.organism', 'state-reports', 'latest.json'), makeStateReport());

    await executeDoctor({ path: tmp, json: true });

    const output = String(stdoutSpy.mock.calls[0]?.[0]);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty('health');
    expect(parsed).toHaveProperty('signals');
    expect(parsed).toHaveProperty('next_action');
    expect(parsed).toHaveProperty('safety');
    expect(parsed).toHaveProperty('recommendations');
  });
});
