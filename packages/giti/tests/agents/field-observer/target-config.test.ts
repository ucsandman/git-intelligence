import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

function baseConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    quality_standards: { test_coverage_floor: 80, max_complexity_per_function: 15, max_file_length: 300, zero_tolerance: [], performance_budget: {} },
    boundaries: { growth_zone: [], forbidden_zone: [] },
    lifecycle: { cycle_frequency: 'daily', max_changes_per_cycle: 1, mandatory_cooldown_after_regression: '48 hours', branch_naming: '', requires_immune_approval: true },
    ...overrides,
  };
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
    await writeConfig(tmp, baseConfig());
    const targets = await loadFieldTargets(tmp);
    expect(targets).toEqual([]);
  });

  it('returns only enabled targets whose path exists and contains .git', async () => {
    const good = await mktmp();
    await fs.mkdir(path.join(good, '.git'));

    const disabled = await mktmp();
    await fs.mkdir(path.join(disabled, '.git'));

    const missing = path.join(os.tmpdir(), 'giti-fo-nonexistent-' + Date.now());

    await writeConfig(tmp, baseConfig({
      field_targets: [
        { slug: 'good', path: good, enabled: true },
        { slug: 'disabled', path: disabled, enabled: false },
        { slug: 'missing', path: missing, enabled: true },
      ],
    }));

    const targets = await loadFieldTargets(tmp);
    expect(targets.map((t) => t.slug)).toEqual(['good']);

    await fs.rm(good, { recursive: true, force: true });
    await fs.rm(disabled, { recursive: true, force: true });
  });

  it('returns empty array when organism.json does not exist at all', async () => {
    // tmp is fresh from beforeEach and has no organism.json
    const targets = await loadFieldTargets(tmp);
    expect(targets).toEqual([]);
  });

  it('returns empty array when organism.json is malformed JSON', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fs.writeFile(path.join(tmp, 'organism.json'), '{ this is not valid json ', 'utf-8');
    const targets = await loadFieldTargets(tmp);
    expect(targets).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns empty array when field_targets is not an array', async () => {
    await writeConfig(tmp, baseConfig({ field_targets: 'oops' }));
    const targets = await loadFieldTargets(tmp);
    expect(targets).toEqual([]);
  });

  it('skips a target whose path exists but is a file, not a directory', async () => {
    const filePath = path.join(tmp, 'not-a-dir');
    await fs.writeFile(filePath, 'hello', 'utf-8');
    await writeConfig(tmp, baseConfig({
      field_targets: [{ slug: 'filey', path: filePath, enabled: true }],
    }));
    const targets = await loadFieldTargets(tmp);
    expect(targets).toEqual([]);
  });

  it('skips a target that is a directory but has no .git entry', async () => {
    const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-nogit-'));
    await writeConfig(tmp, baseConfig({
      field_targets: [{ slug: 'bare', path: dirPath, enabled: true }],
    }));
    const targets = await loadFieldTargets(tmp);
    expect(targets).toEqual([]);
    await fs.rm(dirPath, { recursive: true, force: true });
  });

  it('accepts a target where .git is a file (git worktree case)', async () => {
    const wtPath = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-wt-'));
    await fs.writeFile(path.join(wtPath, '.git'), 'gitdir: /some/real/gitdir\n', 'utf-8');
    await writeConfig(tmp, baseConfig({
      field_targets: [{ slug: 'wt', path: wtPath, enabled: true }],
    }));
    const targets = await loadFieldTargets(tmp);
    expect(targets.map((t) => t.slug)).toEqual(['wt']);
    await fs.rm(wtPath, { recursive: true, force: true });
  });
});
