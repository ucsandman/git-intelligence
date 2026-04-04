import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';

import { getDeadCodeSignals } from '../../src/analyzers/code-analyzer.js';

// Mock node:fs/promises and node:fs
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  statSync: vi.fn(),
}));

import { readdir, readFile } from 'node:fs/promises';

const mockedReaddir = vi.mocked(readdir);
const mockedReadFile = vi.mocked(readFile);

interface MockDirent {
  name: string;
  isFile: () => boolean;
  isDirectory: () => boolean;
  parentPath: string;
}

function makeDirent(name: string, parentPath: string, isFile: boolean): MockDirent {
  return {
    name,
    parentPath,
    isFile: () => isFile,
    isDirectory: () => !isFile,
  };
}

function createMockGit(lastModifiedMap: Record<string, string>): SimpleGit {
  return {
    raw: vi.fn().mockImplementation((args: string[]) => {
      // Match git log -1 --format=%aI -- <filepath>
      if (
        args[0] === 'log' &&
        args[1] === '-1' &&
        args[2] === '--format=%aI'
      ) {
        const filepath = args[4]; // after '--'
        if (filepath && filepath in lastModifiedMap) {
          return Promise.resolve(lastModifiedMap[filepath]!);
        }
        return Promise.resolve('');
      }
      return Promise.resolve('');
    }),
  } as unknown as SimpleGit;
}

/**
 * Helper: set up the mocked readdir to return specific files.
 * Takes a flat list of { path, name } entries representing all files
 * in the repo (relative to repoPath).
 */
function setupFilesystem(
  repoPath: string,
  files: Array<{ dir: string; name: string }>,
  fileContents: Record<string, string> = {},
): void {
  const dirents = files.map((f) =>
    makeDirent(f.name, repoPath + '/' + f.dir, true),
  );

  mockedReaddir.mockResolvedValue(dirents as unknown as Awaited<ReturnType<typeof readdir>>);

  mockedReadFile.mockImplementation((filepath, _encoding) => {
    const p = String(filepath).replace(/\\/g, '/');
    if (p in fileContents) {
      return Promise.resolve(fileContents[p]!);
    }
    return Promise.resolve('');
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDeadCodeSignals', () => {
  const repoPath = '/repo';

  it('returns files not modified in 6+ months with 0 importers', async () => {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const eightMonthsAgoISO = eightMonthsAgo.toISOString();

    setupFilesystem(
      repoPath,
      [
        { dir: 'src/utils', name: 'legacy.ts' },
        { dir: 'src', name: 'app.ts' },
      ],
      {
        '/repo/src/utils/legacy.ts': 'export const old = 1;',
        '/repo/src/app.ts': 'console.log("hello");',
      },
    );

    const git = createMockGit({
      'src/utils/legacy.ts': eightMonthsAgoISO,
      'src/app.ts': eightMonthsAgoISO,
    });

    const result = await getDeadCodeSignals(git, repoPath);

    // Both files are old and neither imports the other
    expect(result.length).toBe(2);
    const legacyResult = result.find((r) => r.filepath === 'src/utils/legacy.ts');
    expect(legacyResult).toBeDefined();
    expect(legacyResult!.importedByCount).toBe(0);
  });

  it('does NOT return files that are imported by other files', async () => {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const eightMonthsAgoISO = eightMonthsAgo.toISOString();

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoISO = oneDayAgo.toISOString();

    setupFilesystem(
      repoPath,
      [
        { dir: 'src/utils', name: 'helper.ts' },
        { dir: 'src', name: 'app.ts' },
      ],
      {
        '/repo/src/utils/helper.ts': 'export function help() {}',
        '/repo/src/app.ts': "import { help } from './utils/helper';",
      },
    );

    const git = createMockGit({
      'src/utils/helper.ts': eightMonthsAgoISO,
      'src/app.ts': oneDayAgoISO,
    });

    const result = await getDeadCodeSignals(git, repoPath);

    // helper.ts is old but imported by app.ts => not dead
    const helperResult = result.find((r) => r.filepath === 'src/utils/helper.ts');
    expect(helperResult).toBeUndefined();
  });

  it('does NOT return recently modified files even if imported by nothing', async () => {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoISO = oneDayAgo.toISOString();

    setupFilesystem(
      repoPath,
      [{ dir: 'src', name: 'app.ts' }],
      {
        '/repo/src/app.ts': 'console.log("hello");',
      },
    );

    const git = createMockGit({
      'src/app.ts': oneDayAgoISO,
    });

    const result = await getDeadCodeSignals(git, repoPath);

    expect(result).toEqual([]);
  });

  it('does NOT return test files (*.test.*, *.spec.*)', async () => {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const eightMonthsAgoISO = eightMonthsAgo.toISOString();

    setupFilesystem(
      repoPath,
      [
        { dir: 'src', name: 'app.test.ts' },
        { dir: 'src', name: 'app.spec.ts' },
        { dir: '__tests__', name: 'app.ts' },
      ],
      {},
    );

    const git = createMockGit({
      'src/app.test.ts': eightMonthsAgoISO,
      'src/app.spec.ts': eightMonthsAgoISO,
      '__tests__/app.ts': eightMonthsAgoISO,
    });

    const result = await getDeadCodeSignals(git, repoPath);

    expect(result).toEqual([]);
  });

  it('handles empty repo (no source files) and returns empty array', async () => {
    mockedReaddir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof readdir>>);

    const git = createMockGit({});

    const result = await getDeadCodeSignals(git, repoPath);

    expect(result).toEqual([]);
  });

  it('custom deadMonths threshold works', async () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoISO = threeMonthsAgo.toISOString();

    setupFilesystem(
      repoPath,
      [{ dir: 'src', name: 'old.ts' }],
      {
        '/repo/src/old.ts': 'export const x = 1;',
      },
    );

    const git = createMockGit({
      'src/old.ts': threeMonthsAgoISO,
    });

    // With default 6 months, file is NOT dead (only 3 months old)
    const resultDefault = await getDeadCodeSignals(git, repoPath);
    expect(resultDefault).toEqual([]);

    // With custom 2 months threshold, file IS dead
    const resultCustom = await getDeadCodeSignals(git, repoPath, 2);
    expect(resultCustom).toHaveLength(1);
    expect(resultCustom[0]!.filepath).toBe('src/old.ts');
  });

  it('detects ES import patterns', async () => {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const eightMonthsAgoISO = eightMonthsAgo.toISOString();

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoISO = oneDayAgo.toISOString();

    setupFilesystem(
      repoPath,
      [
        { dir: 'src/utils', name: 'legacy.ts' },
        { dir: 'src', name: 'main.ts' },
      ],
      {
        '/repo/src/utils/legacy.ts': 'export const x = 1;',
        '/repo/src/main.ts': "import { x } from '../utils/legacy';",
      },
    );

    const git = createMockGit({
      'src/utils/legacy.ts': eightMonthsAgoISO,
      'src/main.ts': oneDayAgoISO,
    });

    const result = await getDeadCodeSignals(git, repoPath);

    // legacy.ts is imported by main.ts => not dead
    const legacy = result.find((r) => r.filepath === 'src/utils/legacy.ts');
    expect(legacy).toBeUndefined();
  });

  it('detects require() patterns', async () => {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const eightMonthsAgoISO = eightMonthsAgo.toISOString();

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoISO = oneDayAgo.toISOString();

    setupFilesystem(
      repoPath,
      [
        { dir: 'src/utils', name: 'legacy.js' },
        { dir: 'src', name: 'main.js' },
      ],
      {
        '/repo/src/utils/legacy.js': 'module.exports = {};',
        '/repo/src/main.js': "const legacy = require('./utils/legacy');",
      },
    );

    const git = createMockGit({
      'src/utils/legacy.js': eightMonthsAgoISO,
      'src/main.js': oneDayAgoISO,
    });

    const result = await getDeadCodeSignals(git, repoPath);

    // legacy.js is required by main.js => not dead
    const legacy = result.find((r) => r.filepath === 'src/utils/legacy.js');
    expect(legacy).toBeUndefined();
  });

  it('sorts results by lastModified ascending (oldest first)', async () => {
    const tenMonthsAgo = new Date();
    tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);

    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);

    setupFilesystem(
      repoPath,
      [
        { dir: 'src', name: 'newer-dead.ts' },
        { dir: 'src', name: 'older-dead.ts' },
      ],
      {
        '/repo/src/newer-dead.ts': 'export const a = 1;',
        '/repo/src/older-dead.ts': 'export const b = 2;',
      },
    );

    const git = createMockGit({
      'src/newer-dead.ts': eightMonthsAgo.toISOString(),
      'src/older-dead.ts': tenMonthsAgo.toISOString(),
    });

    const result = await getDeadCodeSignals(git, repoPath);

    expect(result).toHaveLength(2);
    expect(result[0]!.filepath).toBe('src/older-dead.ts');
    expect(result[1]!.filepath).toBe('src/newer-dead.ts');
  });

  it('handles files with no git history (new untracked files)', async () => {
    setupFilesystem(
      repoPath,
      [{ dir: 'src', name: 'untracked.ts' }],
      {
        '/repo/src/untracked.ts': 'export const x = 1;',
      },
    );

    // Git returns empty string for files with no history
    const git = createMockGit({});

    const result = await getDeadCodeSignals(git, repoPath);

    // File with no git history should be skipped
    expect(result).toEqual([]);
  });

  it('excludes node_modules, dist, coverage, .git directories', async () => {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const eightMonthsAgoISO = eightMonthsAgo.toISOString();

    // Return files from excluded directories — they should be filtered out
    const dirents = [
      makeDirent('lib.ts', repoPath + '/node_modules/pkg', true),
      makeDirent('bundle.ts', repoPath + '/dist', true),
      makeDirent('report.ts', repoPath + '/coverage', true),
      makeDirent('config.ts', repoPath + '/.git/hooks', true),
      makeDirent('app.ts', repoPath + '/src', true),
    ];

    mockedReaddir.mockResolvedValue(dirents as unknown as Awaited<ReturnType<typeof readdir>>);
    mockedReadFile.mockResolvedValue('');

    const git = createMockGit({
      'src/app.ts': eightMonthsAgoISO,
    });

    const result = await getDeadCodeSignals(git, repoPath);

    // Only src/app.ts should be considered, the rest are in excluded dirs
    expect(result).toHaveLength(1);
    expect(result[0]!.filepath).toBe('src/app.ts');
  });

  it('only includes files with supported extensions', async () => {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const eightMonthsAgoISO = eightMonthsAgo.toISOString();

    const dirents = [
      makeDirent('app.ts', repoPath + '/src', true),
      makeDirent('style.css', repoPath + '/src', true),
      makeDirent('readme.md', repoPath + '/src', true),
      makeDirent('data.json', repoPath + '/src', true),
      makeDirent('main.py', repoPath + '/src', true),
    ];

    mockedReaddir.mockResolvedValue(dirents as unknown as Awaited<ReturnType<typeof readdir>>);
    mockedReadFile.mockResolvedValue('');

    const git = createMockGit({
      'src/app.ts': eightMonthsAgoISO,
      'src/main.py': eightMonthsAgoISO,
    });

    const result = await getDeadCodeSignals(git, repoPath);

    // Only .ts and .py files should be included
    expect(result).toHaveLength(2);
    const filepaths = result.map((r) => r.filepath);
    expect(filepaths).toContain('src/app.ts');
    expect(filepaths).toContain('src/main.py');
  });
});
