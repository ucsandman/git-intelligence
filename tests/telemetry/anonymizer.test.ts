import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  bucketCommitCount,
  bucketBranchCount,
  bucketAuthorCount,
  bucketRepoAge,
  detectPrimaryLanguage,
  detectMonorepo,
  buildRepoCharacteristics,
} from '../../src/telemetry/anonymizer.js';

// ── helpers ─────────────────────────────────────────────────────────

let tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-anonymizer-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

// ── bucketCommitCount ──────────────────────────────────────────────

describe('bucketCommitCount', () => {
  it.each([
    [0, '0-100'],
    [50, '0-100'],
    [100, '0-100'],
    [101, '100-1k'],
    [500, '100-1k'],
    [1000, '100-1k'],
    [1001, '1k-10k'],
    [10001, '10k-100k'],
    [100001, '100k+'],
  ])('buckets %i into %s', (input, expected) => {
    expect(bucketCommitCount(input)).toBe(expected);
  });
});

// ── bucketBranchCount ──────────────────────────────────────────────

describe('bucketBranchCount', () => {
  it.each([
    [3, '0-5'],
    [5, '0-5'],
    [6, '5-20'],
    [20, '5-20'],
    [21, '20-50'],
    [50, '20-50'],
    [51, '50+'],
  ])('buckets %i into %s', (input, expected) => {
    expect(bucketBranchCount(input)).toBe(expected);
  });
});

// ── bucketAuthorCount ──────────────────────────────────────────────

describe('bucketAuthorCount', () => {
  it.each([
    [1, '1'],
    [2, '2-5'],
    [5, '2-5'],
    [6, '5-20'],
    [20, '5-20'],
    [21, '20+'],
  ])('buckets %i into %s', (input, expected) => {
    expect(bucketAuthorCount(input)).toBe(expected);
  });
});

// ── bucketRepoAge ──────────────────────────────────────────────────

describe('bucketRepoAge', () => {
  it('returns <1mo for a date 15 days ago', () => {
    const date = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    expect(bucketRepoAge(date)).toBe('<1mo');
  });

  it('returns 1-6mo for a date 3 months ago', () => {
    const date = new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000);
    expect(bucketRepoAge(date)).toBe('1-6mo');
  });

  it('returns 6mo-2y for a date 12 months ago', () => {
    const date = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
    expect(bucketRepoAge(date)).toBe('6mo-2y');
  });

  it('returns 2y+ for a date 30 months ago', () => {
    const date = new Date(Date.now() - 30 * 30 * 24 * 60 * 60 * 1000);
    expect(bucketRepoAge(date)).toBe('2y+');
  });
});

// ── detectPrimaryLanguage ──────────────────────────────────────────

describe('detectPrimaryLanguage', () => {
  it('detects TypeScript as primary when .ts has the most files', () => {
    expect(detectPrimaryLanguage({ '.ts': 20, '.js': 5 })).toBe('TypeScript');
  });

  it('detects Python when only .py files are present', () => {
    expect(detectPrimaryLanguage({ '.py': 10 })).toBe('Python');
  });

  it('returns Unknown when no recognized extensions exist', () => {
    expect(detectPrimaryLanguage({ '.txt': 100 })).toBe('Unknown');
  });

  it('returns Unknown for an empty map', () => {
    expect(detectPrimaryLanguage({})).toBe('Unknown');
  });

  it('groups .tsx with TypeScript', () => {
    expect(detectPrimaryLanguage({ '.tsx': 15, '.py': 10 })).toBe('TypeScript');
  });
});

// ── detectMonorepo ─────────────────────────────────────────────────

describe('detectMonorepo', () => {
  it('returns true when packages/ directory exists', async () => {
    const tmp = await makeTmpDir();
    await fs.mkdir(path.join(tmp, 'packages'), { recursive: true });
    expect(await detectMonorepo(tmp)).toBe(true);
  });

  it('returns true when apps/ directory exists', async () => {
    const tmp = await makeTmpDir();
    await fs.mkdir(path.join(tmp, 'apps'), { recursive: true });
    expect(await detectMonorepo(tmp)).toBe(true);
  });

  it('returns true when lerna.json exists', async () => {
    const tmp = await makeTmpDir();
    await fs.writeFile(path.join(tmp, 'lerna.json'), '{}', 'utf-8');
    expect(await detectMonorepo(tmp)).toBe(true);
  });

  it('returns true when pnpm-workspace.yaml exists', async () => {
    const tmp = await makeTmpDir();
    await fs.writeFile(path.join(tmp, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*', 'utf-8');
    expect(await detectMonorepo(tmp)).toBe(true);
  });

  it('returns true when package.json has workspaces', async () => {
    const tmp = await makeTmpDir();
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'test', workspaces: ['packages/*'] }),
      'utf-8',
    );
    expect(await detectMonorepo(tmp)).toBe(true);
  });

  it('returns false for a plain directory', async () => {
    const tmp = await makeTmpDir();
    expect(await detectMonorepo(tmp)).toBe(false);
  });

  it('returns false when package.json has no workspaces', async () => {
    const tmp = await makeTmpDir();
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' }),
      'utf-8',
    );
    expect(await detectMonorepo(tmp)).toBe(false);
  });

  it('returns false for a nonexistent path', async () => {
    expect(await detectMonorepo('/tmp/nonexistent-path-12345')).toBe(false);
  });
});

// ── buildRepoCharacteristics ───────────────────────────────────────

describe('buildRepoCharacteristics', () => {
  it('builds characteristics from mocked git data', async () => {
    const tmp = await makeTmpDir();

    const mockGit = {
      log: vi.fn()
        .mockResolvedValueOnce({ total: 250, all: [] })           // commit count
        .mockResolvedValueOnce({                                    // recent log for authors
          total: 3,
          all: [
            { author_name: 'Alice' },
            { author_name: 'Bob' },
            { author_name: 'Alice' },
          ],
        }),
      branch: vi.fn().mockResolvedValue({
        all: ['main', 'feature-a', 'feature-b'],
      }),
      raw: vi.fn().mockImplementation((args: string[]) => {
        if (args[0] === 'log' && args.includes('--reverse')) {
          // Return a date 4 months ago
          const date = new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000);
          return Promise.resolve(date.toISOString());
        }
        if (args[0] === 'ls-files') {
          return Promise.resolve('src/index.ts\nsrc/utils.ts\nsrc/app.tsx\nREADME.md\n');
        }
        return Promise.resolve('');
      }),
    };

    const result = await buildRepoCharacteristics(mockGit as never, tmp);

    expect(result.commit_count_bucket).toBe('100-1k');
    expect(result.branch_count_bucket).toBe('0-5');
    expect(result.author_count_bucket).toBe('2-5');
    expect(result.primary_language).toBe('TypeScript');
    expect(result.has_monorepo_structure).toBe(false);
    expect(result.age_bucket).toBe('1-6mo');
  });

  it('returns safe defaults when git operations fail', async () => {
    const tmp = await makeTmpDir();

    const mockGit = {
      log: vi.fn().mockRejectedValue(new Error('not a git repo')),
      branch: vi.fn().mockRejectedValue(new Error('not a git repo')),
      raw: vi.fn().mockRejectedValue(new Error('not a git repo')),
    };

    const result = await buildRepoCharacteristics(mockGit as never, tmp);

    expect(result).toEqual({
      commit_count_bucket: '0-100',
      branch_count_bucket: '0-5',
      author_count_bucket: '1',
      primary_language: 'Unknown',
      has_monorepo_structure: false,
      age_bucket: '<1mo',
    });
  });

  it('detects monorepo structure in repo characteristics', async () => {
    const tmp = await makeTmpDir();
    await fs.mkdir(path.join(tmp, 'packages'), { recursive: true });

    const mockGit = {
      log: vi.fn()
        .mockResolvedValueOnce({ total: 5000, all: [] })
        .mockResolvedValueOnce({
          total: 1,
          all: [{ author_name: 'Solo' }],
        }),
      branch: vi.fn().mockResolvedValue({
        all: Array.from({ length: 30 }, (_, i) => `branch-${i}`),
      }),
      raw: vi.fn().mockImplementation((args: string[]) => {
        if (args[0] === 'log' && args.includes('--reverse')) {
          const date = new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000);
          return Promise.resolve(date.toISOString());
        }
        if (args[0] === 'ls-files') {
          return Promise.resolve('packages/core/index.py\npackages/cli/main.py\n');
        }
        return Promise.resolve('');
      }),
    };

    const result = await buildRepoCharacteristics(mockGit as never, tmp);

    expect(result.commit_count_bucket).toBe('1k-10k');
    expect(result.branch_count_bucket).toBe('20-50');
    expect(result.author_count_bucket).toBe('1');
    expect(result.primary_language).toBe('Python');
    expect(result.has_monorepo_structure).toBe(true);
    expect(result.age_bucket).toBe('2y+');
  });
});
