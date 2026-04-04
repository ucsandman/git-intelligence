import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';

// vi.hoisted ensures the variable is available when vi.mock factory runs (hoisted)
const { mockReaddir } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: { readdir: mockReaddir },
  readdir: mockReaddir,
}));

import {
  getLastCommit,
  getWeeklyStats,
  getAvgCommitSize,
  getBusFactor,
  getHottestFile,
  getTestRatio,
} from '../../src/analyzers/commit-analyzer.js';

function createMockGit(overrides: Record<string, unknown> = {}): SimpleGit {
  return {
    log: vi.fn().mockResolvedValue({
      all: [
        {
          hash: 'abc123',
          date: '2026-04-03T10:00:00Z',
          message: 'fix: resolve auth bug',
          author_name: 'Alice',
          diff: { changed: 3, insertions: 20, deletions: 5, files: [] },
        },
        {
          hash: 'def456',
          date: '2026-04-02T10:00:00Z',
          message: 'feat: add login page',
          author_name: 'Bob',
          diff: { changed: 5, insertions: 100, deletions: 10, files: [] },
        },
      ],
      total: 2,
    }),
    raw: vi.fn().mockResolvedValue(''),
    ...overrides,
  } as unknown as SimpleGit;
}

describe('getLastCommit', () => {
  it('returns correct date, message, and author', async () => {
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            date: '2026-04-03T10:00:00Z',
            message: 'fix: resolve auth bug',
            author_name: 'Alice',
          },
        ],
        total: 1,
      }),
    });

    const result = await getLastCommit(git);

    expect(result.date).toEqual(new Date('2026-04-03T10:00:00Z'));
    expect(result.message).toBe('fix: resolve auth bug');
    expect(result.author).toBe('Alice');
    expect(git.log).toHaveBeenCalledWith({ maxCount: 1 });
  });

  it('truncates messages longer than 60 characters', async () => {
    const longMessage =
      'feat: this is a very long commit message that should be truncated because it exceeds sixty characters';
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            date: '2026-04-03T10:00:00Z',
            message: longMessage,
            author_name: 'Alice',
          },
        ],
        total: 1,
      }),
    });

    const result = await getLastCommit(git);

    expect(result.message.length).toBeLessThanOrEqual(63); // 60 + "..."
    expect(result.message).toBe(longMessage.slice(0, 60) + '...');
  });

  it('does not truncate messages at exactly 60 characters', async () => {
    const exactMessage = 'a'.repeat(60);
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            date: '2026-04-03T10:00:00Z',
            message: exactMessage,
            author_name: 'Alice',
          },
        ],
        total: 1,
      }),
    });

    const result = await getLastCommit(git);

    expect(result.message).toBe(exactMessage);
  });
});

describe('getWeeklyStats', () => {
  it('returns correct count and unique author count', async () => {
    const git = createMockGit();

    const result = await getWeeklyStats(git);

    expect(result.count).toBe(2);
    expect(result.authorCount).toBe(2);
    expect(git.log).toHaveBeenCalledWith({ '--since': '7 days ago' });
  });

  it('counts unique authors correctly when duplicated', async () => {
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({
        all: [
          { hash: 'a', date: '2026-04-03T10:00:00Z', message: 'fix a', author_name: 'Alice' },
          { hash: 'b', date: '2026-04-03T09:00:00Z', message: 'fix b', author_name: 'Alice' },
          { hash: 'c', date: '2026-04-02T10:00:00Z', message: 'fix c', author_name: 'Bob' },
        ],
        total: 3,
      }),
    });

    const result = await getWeeklyStats(git);

    expect(result.count).toBe(3);
    expect(result.authorCount).toBe(2);
  });

  it('returns zero for empty log', async () => {
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({ all: [], total: 0 }),
    });

    const result = await getWeeklyStats(git);

    expect(result.count).toBe(0);
    expect(result.authorCount).toBe(0);
  });
});

describe('getAvgCommitSize', () => {
  it('calculates mean of insertions + deletions', async () => {
    const git = createMockGit();

    const result = await getAvgCommitSize(git);

    // commit1: 20 + 5 = 25, commit2: 100 + 10 = 110 => mean = 67.5 => round = 68
    expect(result).toBe(68);
  });

  it('returns 0 for empty log', async () => {
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({ all: [], total: 0 }),
    });

    const result = await getAvgCommitSize(git);

    expect(result).toBe(0);
  });

  it('handles commits with no diff info', async () => {
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({
        all: [
          { hash: 'a', date: '2026-04-03T10:00:00Z', message: 'fix a', author_name: 'Alice' },
        ],
        total: 1,
      }),
    });

    const result = await getAvgCommitSize(git);

    expect(result).toBe(0);
  });
});

describe('getBusFactor', () => {
  it('calculates bus factor of 1 when one author dominates', async () => {
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({
        all: [
          { hash: 'a', author_name: 'Alice' },
          { hash: 'b', author_name: 'Alice' },
          { hash: 'c', author_name: 'Alice' },
          { hash: 'd', author_name: 'Alice' },
          { hash: 'e', author_name: 'Bob' },
        ],
        total: 5,
      }),
    });

    const result = await getBusFactor(git);

    expect(result.count).toBe(1);
    expect(result.topAuthorCount).toBe(1);
    expect(result.topAuthorsPercentage).toBe(80);
    expect(git.log).toHaveBeenCalledWith({ '--since': '90 days ago' });
  });

  it('calculates bus factor of 2 when two authors needed for 50%', async () => {
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({
        all: [
          { hash: 'a', author_name: 'Alice' },
          { hash: 'b', author_name: 'Alice' },
          { hash: 'c', author_name: 'Alice' },
          { hash: 'd', author_name: 'Bob' },
          { hash: 'e', author_name: 'Bob' },
          { hash: 'f', author_name: 'Bob' },
          { hash: 'g', author_name: 'Charlie' },
          { hash: 'h', author_name: 'Charlie' },
          { hash: 'i', author_name: 'Dave' },
          { hash: 'j', author_name: 'Dave' },
        ],
        total: 10,
      }),
    });

    const result = await getBusFactor(git);

    // Alice: 3 (30%), Bob: 3 (30%), Charlie: 2 (20%), Dave: 2 (20%)
    // Need Alice + Bob to reach 60% >= 50% => bus factor = 2
    expect(result.count).toBe(2);
    expect(result.topAuthorCount).toBe(2);
    expect(result.topAuthorsPercentage).toBe(60);
  });

  it('returns 0 for empty log', async () => {
    const git = createMockGit({
      log: vi.fn().mockResolvedValue({ all: [], total: 0 }),
    });

    const result = await getBusFactor(git);

    expect(result.count).toBe(0);
    expect(result.topAuthorCount).toBe(0);
    expect(result.topAuthorsPercentage).toBe(0);
  });
});

describe('getHottestFile', () => {
  it('returns the most changed file', async () => {
    const rawOutput = [
      'src/auth.ts',
      'src/db.ts',
      '',
      'src/auth.ts',
      'src/utils.ts',
      '',
      'src/auth.ts',
      '',
    ].join('\n');

    const git = createMockGit({
      raw: vi.fn().mockResolvedValue(rawOutput),
    });

    const result = await getHottestFile(git);

    expect(result).toEqual({ path: 'src/auth.ts', changeCount: 3 });
  });

  it('returns null for empty log', async () => {
    const git = createMockGit({
      raw: vi.fn().mockResolvedValue(''),
    });

    const result = await getHottestFile(git);

    expect(result).toBeNull();
  });

  it('returns null when raw output is only whitespace', async () => {
    const git = createMockGit({
      raw: vi.fn().mockResolvedValue('\n\n\n'),
    });

    const result = await getHottestFile(git);

    expect(result).toBeNull();
  });
});

describe('getTestRatio', () => {
  beforeEach(() => {
    mockReaddir.mockReset();
  });

  it('counts source and test files correctly', async () => {
    mockReaddir.mockImplementation(async (dirPath: string) => {
      if (dirPath.endsWith('fake-repo')) {
        return [
          createDirent('src', true),
          createDirent('node_modules', true),
          createDirent('package.json', false),
        ];
      }
      if (dirPath.endsWith('src')) {
        return [
          createDirent('app.ts', false),
          createDirent('utils.ts', false),
          createDirent('app.test.ts', false),
          createDirent('__tests__', true),
        ];
      }
      if (dirPath.includes('__tests__')) {
        return [createDirent('helper.test.ts', false)];
      }
      return [];
    });

    const result = await getTestRatio('/fake-repo');

    // Source files: app.ts, utils.ts, app.test.ts, helper.test.ts = 4
    // Test files: app.test.ts, helper.test.ts = 2
    // percentage = Math.round((2 / 4) * 100) = 50
    expect(result.sourceFiles).toBe(4);
    expect(result.testFiles).toBe(2);
    expect(result.percentage).toBe(50);
  });

  it('excludes node_modules and dist directories', async () => {
    mockReaddir.mockImplementation(async (dirPath: string) => {
      if (dirPath.endsWith('fake-repo')) {
        return [
          createDirent('src', true),
          createDirent('node_modules', true),
          createDirent('dist', true),
          createDirent('coverage', true),
        ];
      }
      if (dirPath.endsWith('src')) {
        return [createDirent('index.ts', false)];
      }
      if (dirPath.includes('node_modules') || dirPath.includes('dist') || dirPath.includes('coverage')) {
        throw new Error('Should not traverse excluded directories');
      }
      return [];
    });

    const result = await getTestRatio('/fake-repo');

    expect(result.sourceFiles).toBe(1);
    expect(result.testFiles).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('returns 0 percentage when no source files exist', async () => {
    mockReaddir.mockImplementation(async () => []);

    const result = await getTestRatio('/empty-repo');

    expect(result.sourceFiles).toBe(0);
    expect(result.testFiles).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('recognizes spec files as test files', async () => {
    mockReaddir.mockImplementation(async (dirPath: string) => {
      if (dirPath.endsWith('fake-repo')) {
        return [createDirent('src', true)];
      }
      if (dirPath.endsWith('src')) {
        return [
          createDirent('app.ts', false),
          createDirent('app.spec.ts', false),
        ];
      }
      return [];
    });

    const result = await getTestRatio('/fake-repo');

    expect(result.sourceFiles).toBe(2);
    expect(result.testFiles).toBe(1);
    expect(result.percentage).toBe(50);
  });
});

function createDirent(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: '',
    path: '',
  };
}
