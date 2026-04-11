import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { observe } from '../../../src/agents/field-observer/index.js';
import { createTempRepo, type TempRepo } from './helpers.js';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function (this: {
    messages: { create: typeof mockCreate };
  }) {
    this.messages = { create: mockCreate };
  }),
}));

describe('observe', () => {
  let gitiHome: string;
  let target: TempRepo;

  beforeEach(async () => {
    gitiHome = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-home-'));
    target = await createTempRepo();

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Quiet morning at the sample repo.' }],
      usage: { input_tokens: 50, output_tokens: 15 },
    });

    // Write a valid organism.json into the temp giti home
    await fs.writeFile(
      path.join(gitiHome, 'organism.json'),
      JSON.stringify({
        quality_standards: {
          test_coverage_floor: 80,
          max_complexity_per_function: 15,
          max_file_length: 300,
          zero_tolerance: [],
          performance_budget: {},
        },
        boundaries: { growth_zone: [], forbidden_zone: [] },
        lifecycle: {
          cycle_frequency: 'daily',
          max_changes_per_cycle: 1,
          mandatory_cooldown_after_regression: '48 hours',
          branch_naming: '',
          requires_immune_approval: true,
        },
        field_targets: [{ slug: 'sample', path: target.path, enabled: true }],
        narrator: {
          enabled: true,
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          cache_system_prompt: true,
        },
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(gitiHome, { recursive: true, force: true });
    await target.cleanup();
    mockCreate.mockReset();
  });

  it('produces a field report on disk under gitiHome/.organism/field-reports/<slug>/', async () => {
    const observations = await observe(gitiHome, 99);

    expect(observations).toHaveLength(1);
    expect(observations[0]!.target).toBe('sample');
    expect(observations[0]!.cycle).toBe(99);
    expect(observations[0]!.narrative).toContain('Quiet morning');

    const reportsDir = path.join(gitiHome, '.organism', 'field-reports', 'sample');
    const entries = await fs.readdir(reportsDir);
    const mds = entries.filter((e) => e.endsWith('.md'));
    const jsons = entries.filter((e) => e.endsWith('.json'));
    const latest = entries.filter((e) => e === 'latest.json');

    expect(mds.length).toBeGreaterThanOrEqual(1);
    expect(jsons.length).toBeGreaterThanOrEqual(2); // timestamped + latest.json
    expect(latest).toHaveLength(1);
  });

  it('returns [] when no field_targets are configured', async () => {
    await fs.writeFile(
      path.join(gitiHome, 'organism.json'),
      JSON.stringify({
        quality_standards: {
          test_coverage_floor: 80,
          max_complexity_per_function: 15,
          max_file_length: 300,
          zero_tolerance: [],
          performance_budget: {},
        },
        boundaries: { growth_zone: [], forbidden_zone: [] },
        lifecycle: {
          cycle_frequency: 'daily',
          max_changes_per_cycle: 1,
          mandatory_cooldown_after_regression: '48 hours',
          branch_naming: '',
          requires_immune_approval: true,
        },
      }),
    );

    const observations = await observe(gitiHome, 100);
    expect(observations).toEqual([]);
  });

  it('derives mood as curious on first ever observation', async () => {
    const [obs] = await observe(gitiHome, 99);
    expect(obs!.mood).toBe('curious');
  });
});
