import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadFieldTargets } from '../../../src/agents/field-observer/target-config.js';

async function writeConfig(dir: string, config: unknown): Promise<void> {
  await fs.writeFile(path.join(dir, 'organism.json'), JSON.stringify(config), 'utf-8');
}

async function mktmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-target-'));
}

describe('loadFieldTargets', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mktmp();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns empty array when organism.json lacks field_targets', async () => {
    await writeConfig(tmp, {
      quality_standards: { test_coverage_floor: 80, max_complexity_per_function: 15, max_file_length: 300, zero_tolerance: [], performance_budget: {} },
      boundaries: { growth_zone: [], forbidden_zone: [] },
      lifecycle: { cycle_frequency: 'daily', max_changes_per_cycle: 1, mandatory_cooldown_after_regression: '48 hours', branch_naming: '', requires_immune_approval: true },
    });
    const targets = await loadFieldTargets(tmp);
    expect(targets).toEqual([]);
  });

  it('returns only enabled targets whose path exists and contains .git', async () => {
    const good = await mktmp();
    await fs.mkdir(path.join(good, '.git'));

    const disabled = await mktmp();
    await fs.mkdir(path.join(disabled, '.git'));

    const missing = path.join(os.tmpdir(), 'giti-fo-nonexistent-' + Date.now());

    await writeConfig(tmp, {
      quality_standards: { test_coverage_floor: 80, max_complexity_per_function: 15, max_file_length: 300, zero_tolerance: [], performance_budget: {} },
      boundaries: { growth_zone: [], forbidden_zone: [] },
      lifecycle: { cycle_frequency: 'daily', max_changes_per_cycle: 1, mandatory_cooldown_after_regression: '48 hours', branch_naming: '', requires_immune_approval: true },
      field_targets: [
        { slug: 'good', path: good, enabled: true },
        { slug: 'disabled', path: disabled, enabled: false },
        { slug: 'missing', path: missing, enabled: true },
      ],
    });

    const targets = await loadFieldTargets(tmp);
    expect(targets.map((t) => t.slug)).toEqual(['good']);

    await fs.rm(good, { recursive: true, force: true });
    await fs.rm(disabled, { recursive: true, force: true });
  });
});
