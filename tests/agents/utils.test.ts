import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ensureOrganismDir,
  readJsonFile,
  writeJsonFile,
  getOrganismPath,
  runCommand,
  loadOrganismConfig,
} from '../../src/agents/utils.js';

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('ensureOrganismDir', () => {
  it('creates .organism directory at repo root', async () => {
    const tmp = await makeTmpDir();
    const result = await ensureOrganismDir(tmp);
    const stat = await fs.stat(result);
    expect(stat.isDirectory()).toBe(true);
    expect(result).toBe(path.join(tmp, '.organism'));
  });

  it('creates nested subdirectories', async () => {
    const tmp = await makeTmpDir();
    const result = await ensureOrganismDir(tmp, 'sensory', 'snapshots');
    const stat = await fs.stat(result);
    expect(stat.isDirectory()).toBe(true);
    expect(result).toBe(path.join(tmp, '.organism', 'sensory', 'snapshots'));
  });

  it('is idempotent on existing directories', async () => {
    const tmp = await makeTmpDir();
    const first = await ensureOrganismDir(tmp, 'data');
    const second = await ensureOrganismDir(tmp, 'data');
    expect(first).toBe(second);
  });
});

describe('readJsonFile', () => {
  it('returns parsed JSON for existing file', async () => {
    const tmp = await makeTmpDir();
    const filePath = path.join(tmp, 'data.json');
    await fs.writeFile(filePath, JSON.stringify({ key: 'value' }), 'utf-8');

    const result = await readJsonFile<{ key: string }>(filePath);
    expect(result).toEqual({ key: 'value' });
  });

  it('returns null for missing file', async () => {
    const tmp = await makeTmpDir();
    const result = await readJsonFile(path.join(tmp, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    const tmp = await makeTmpDir();
    const filePath = path.join(tmp, 'bad.json');
    await fs.writeFile(filePath, 'not json', 'utf-8');

    const result = await readJsonFile(filePath);
    expect(result).toBeNull();
  });
});

describe('writeJsonFile', () => {
  it('writes JSON to file', async () => {
    const tmp = await makeTmpDir();
    const filePath = path.join(tmp, 'output.json');
    await writeJsonFile(filePath, { hello: 'world' });

    const content = await fs.readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual({ hello: 'world' });
  });

  it('creates parent directories', async () => {
    const tmp = await makeTmpDir();
    const filePath = path.join(tmp, 'deep', 'nested', 'output.json');
    await writeJsonFile(filePath, { nested: true });

    const content = await fs.readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual({ nested: true });
  });

  it('can be read back with readJsonFile', async () => {
    const tmp = await makeTmpDir();
    const filePath = path.join(tmp, 'roundtrip.json');
    const data = { count: 42, items: ['a', 'b'] };
    await writeJsonFile(filePath, data);

    const result = await readJsonFile(filePath);
    expect(result).toEqual(data);
  });
});

describe('getOrganismPath', () => {
  it('joins repo path with .organism', () => {
    const result = getOrganismPath('/repo');
    expect(result).toBe(path.join('/repo', '.organism'));
  });

  it('appends additional path parts', () => {
    const result = getOrganismPath('/repo', 'sensory', 'snapshot.json');
    expect(result).toBe(path.join('/repo', '.organism', 'sensory', 'snapshot.json'));
  });
});

describe('runCommand', () => {
  it('runs a command successfully', () => {
    const result = runCommand('node', ['--version'], process.cwd());
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^v\d+/);
    expect(result.stderr).toBe('');
  });

  it('handles command failure gracefully', () => {
    const result = runCommand('node', ['-e', 'process.exit(1)'], process.cwd());
    expect(result.status).toBe(1);
  });

  it('captures stderr on failure', () => {
    const result = runCommand('node', ['-e', 'console.error("oops"); process.exit(2)'], process.cwd());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('oops');
  });
});

describe('loadOrganismConfig', () => {
  it('throws if organism.json not found', async () => {
    const tmp = await makeTmpDir();
    await expect(loadOrganismConfig(tmp)).rejects.toThrow('organism.json not found');
  });

  it('returns parsed config if exists', async () => {
    const tmp = await makeTmpDir();
    const config = {
      quality_standards: {
        test_coverage_floor: 80,
        max_complexity_per_function: 15,
        max_file_length: 400,
        zero_tolerance: ['type-errors'],
        performance_budget: { 'test-suite': '120s' },
      },
      boundaries: {
        growth_zone: ['src/'],
        forbidden_zone: ['node_modules/'],
      },
      lifecycle: {
        cycle_frequency: 'daily',
        max_changes_per_cycle: 3,
        mandatory_cooldown_after_regression: '24h',
        branch_naming: 'organism/cycle-{n}',
        requires_immune_approval: true,
      },
    };
    await fs.writeFile(path.join(tmp, 'organism.json'), JSON.stringify(config), 'utf-8');

    const result = await loadOrganismConfig(tmp);
    expect(result).toEqual(config);
  });
});
