import { describe, it, expect, vi } from 'vitest';
import type { SimpleGit } from 'simple-git';

import {
  getHotspots,
  getFileCouplings,
} from '../../src/analyzers/file-analyzer.js';

/**
 * Helper: build a mock git raw output string from commit data.
 * Each commit is: `hash|author|message` followed by file paths, separated by blank lines.
 */
function buildRawLog(
  commits: Array<{ hash: string; author: string; message: string; files: string[] }>,
): string {
  return commits
    .map((c) => {
      const header = `${c.hash}|${c.author}|${c.message}`;
      return [header, ...c.files].join('\n');
    })
    .join('\n\n');
}

function createMockGit(rawOutput: string): SimpleGit {
  return {
    raw: vi.fn().mockResolvedValue(rawOutput),
  } as unknown as SimpleGit;
}

// ---- getHotspots ----

describe('getHotspots', () => {
  const since = new Date('2026-01-01');

  it('ranks files by change count correctly', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'feat: add auth', files: ['src/auth.ts', 'src/routes.ts'] },
      { hash: 'a2', author: 'Bob', message: 'feat: add login', files: ['src/auth.ts', 'src/utils.ts'] },
      { hash: 'a3', author: 'Alice', message: 'feat: refactor', files: ['src/auth.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    expect(result[0]!.filepath).toBe('src/auth.ts');
    expect(result[0]!.changes).toBe(3);
    expect(result[1]!.filepath).toBe('src/routes.ts');
    expect(result[1]!.changes).toBe(1);
    expect(result[2]!.filepath).toBe('src/utils.ts');
    expect(result[2]!.changes).toBe(1);
  });

  it('counts unique authors per file', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'feat: a', files: ['src/auth.ts'] },
      { hash: 'a2', author: 'Bob', message: 'feat: b', files: ['src/auth.ts'] },
      { hash: 'a3', author: 'Alice', message: 'feat: c', files: ['src/auth.ts'] },
      { hash: 'a4', author: 'Charlie', message: 'feat: d', files: ['src/utils.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    const auth = result.find((h) => h.filepath === 'src/auth.ts')!;
    expect(auth.authors).toBe(2); // Alice, Bob

    const utils = result.find((h) => h.filepath === 'src/utils.ts')!;
    expect(utils.authors).toBe(1); // Charlie
  });

  it('detects bug fix commits with "fix" keyword', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'fix: resolve auth bug', files: ['src/auth.ts'] },
      { hash: 'a2', author: 'Bob', message: 'feat: add login', files: ['src/auth.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    expect(result[0]!.bugFixes).toBe(1);
  });

  it('detects bug fix commits with "bug" keyword', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'bug fix in auth module', files: ['src/auth.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    expect(result[0]!.bugFixes).toBe(1);
  });

  it('detects bug fix commits with "patch" keyword', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'patch: security update', files: ['src/auth.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    expect(result[0]!.bugFixes).toBe(1);
  });

  it('detects bug fix commits with "resolve" keyword', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'resolve issue #42', files: ['src/auth.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    expect(result[0]!.bugFixes).toBe(1);
  });

  it('detects bug fix commits with "revert" keyword', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'revert: undo bad change', files: ['src/auth.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    expect(result[0]!.bugFixes).toBe(1);
  });

  it('does not count non-bugfix commits as bugFixes', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'feat: add new feature', files: ['src/auth.ts'] },
      { hash: 'a2', author: 'Bob', message: 'chore: update deps', files: ['src/auth.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    expect(result[0]!.bugFixes).toBe(0);
  });

  it('respects the top parameter', async () => {
    const raw = buildRawLog([
      { hash: 'a1', author: 'Alice', message: 'feat: a', files: ['src/a.ts'] },
      { hash: 'a2', author: 'Alice', message: 'feat: b', files: ['src/a.ts', 'src/b.ts'] },
      { hash: 'a3', author: 'Alice', message: 'feat: c', files: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
      { hash: 'a4', author: 'Alice', message: 'feat: d', files: ['src/d.ts'] },
    ]);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since, 2);

    expect(result).toHaveLength(2);
    expect(result[0]!.filepath).toBe('src/a.ts');
    expect(result[1]!.filepath).toBe('src/b.ts');
  });

  it('returns empty array for no commits', async () => {
    const git = createMockGit('');

    const result = await getHotspots(git, since);

    expect(result).toEqual([]);
  });

  it('returns empty array for whitespace-only output', async () => {
    const git = createMockGit('\n\n  \n');

    const result = await getHotspots(git, since);

    expect(result).toEqual([]);
  });

  it('uses default top=10 when not specified', async () => {
    // Create 12 unique files, each changed once
    const commits = Array.from({ length: 12 }, (_, i) => ({
      hash: `h${i}`,
      author: 'Alice',
      message: 'feat: change',
      files: [`src/file${i}.ts`],
    }));
    const raw = buildRawLog(commits);
    const git = createMockGit(raw);

    const result = await getHotspots(git, since);

    expect(result).toHaveLength(10);
  });

  it('passes correct --since argument to git.raw', async () => {
    const git = createMockGit('');
    const testDate = new Date('2026-03-15T00:00:00.000Z');

    await getHotspots(git, testDate);

    expect(git.raw).toHaveBeenCalledWith(
      expect.arrayContaining(['--since=' + testDate.toISOString()]),
    );
  });
});

// ---- getFileCouplings ----

describe('getFileCouplings', () => {
  const since = new Date('2026-01-01');

  it('detects files that always change together', async () => {
    // auth.ts and routes.ts change together in all 8 commits
    // auth.ts also changes alone in 2 more commits (total 10)
    // routes.ts total = 8
    const commits = [
      ...Array.from({ length: 8 }, (_, i) => ({
        hash: `c${i}`,
        author: 'Alice',
        message: 'feat: update',
        files: ['src/auth.ts', 'src/routes.ts'],
      })),
      { hash: 'c8', author: 'Alice', message: 'feat: solo1', files: ['src/auth.ts'] },
      { hash: 'c9', author: 'Alice', message: 'feat: solo2', files: ['src/auth.ts'] },
    ];
    const raw = buildRawLog(commits);
    const git = createMockGit(raw);

    const result = await getFileCouplings(git, since);

    expect(result).toHaveLength(1);
    expect(result[0]!.fileA).toBeDefined();
    expect(result[0]!.fileB).toBeDefined();
    // Pair should contain both files
    const pair = [result[0]!.fileA, result[0]!.fileB].sort();
    expect(pair).toEqual(['src/auth.ts', 'src/routes.ts']);
    // 8 / min(10, 8) = 8/8 = 100%
    expect(result[0]!.coOccurrences).toBe(8);
    expect(result[0]!.percentage).toBe(100);
  });

  it('ignores pairs below 5-change threshold', async () => {
    // utils.ts only appears in 3 commits, below threshold
    const commits = [
      ...Array.from({ length: 6 }, (_, i) => ({
        hash: `c${i}`,
        author: 'Alice',
        message: 'feat: work',
        files: ['src/auth.ts', 'src/routes.ts'],
      })),
      { hash: 'c6', author: 'Alice', message: 'feat: a', files: ['src/utils.ts', 'src/auth.ts'] },
      { hash: 'c7', author: 'Alice', message: 'feat: b', files: ['src/utils.ts', 'src/auth.ts'] },
      { hash: 'c8', author: 'Alice', message: 'feat: c', files: ['src/utils.ts', 'src/auth.ts'] },
    ];
    const raw = buildRawLog(commits);
    const git = createMockGit(raw);

    const result = await getFileCouplings(git, since);

    // Only auth.ts (9 changes) + routes.ts (6 changes) should appear
    // utils.ts only has 3 changes, so any pair including it should be excluded
    expect(result).toHaveLength(1);
    const pair = [result[0]!.fileA, result[0]!.fileB].sort();
    expect(pair).toEqual(['src/auth.ts', 'src/routes.ts']);
  });

  it('ignores pairs below 60% co-occurrence', async () => {
    // auth.ts changes 10 times, routes.ts changes 10 times
    // But they only co-occur 5 times => 5 / min(10,10) = 50% — below threshold
    const commits = [
      ...Array.from({ length: 5 }, (_, i) => ({
        hash: `both${i}`,
        author: 'Alice',
        message: 'feat: both',
        files: ['src/auth.ts', 'src/routes.ts'],
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        hash: `auth${i}`,
        author: 'Alice',
        message: 'feat: auth only',
        files: ['src/auth.ts'],
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        hash: `routes${i}`,
        author: 'Alice',
        message: 'feat: routes only',
        files: ['src/routes.ts'],
      })),
    ];
    const raw = buildRawLog(commits);
    const git = createMockGit(raw);

    const result = await getFileCouplings(git, since);

    expect(result).toEqual([]);
  });

  it('calculates percentage correctly', async () => {
    // auth.ts = 10 changes, routes.ts = 8 changes, co-occur = 7
    // percentage = 7 / min(10, 8) * 100 = 7/8 * 100 = 87.5
    const commits = [
      ...Array.from({ length: 7 }, (_, i) => ({
        hash: `both${i}`,
        author: 'Alice',
        message: 'feat: both',
        files: ['src/auth.ts', 'src/routes.ts'],
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        hash: `auth${i}`,
        author: 'Alice',
        message: 'feat: auth only',
        files: ['src/auth.ts'],
      })),
      { hash: 'routes0', author: 'Alice', message: 'feat: routes only', files: ['src/routes.ts'] },
    ];
    const raw = buildRawLog(commits);
    const git = createMockGit(raw);

    const result = await getFileCouplings(git, since);

    expect(result).toHaveLength(1);
    expect(result[0]!.coOccurrences).toBe(7);
    expect(result[0]!.percentage).toBeCloseTo(87.5);
  });

  it('sorts by percentage descending', async () => {
    // Create two pairs with different coupling percentages
    // Pair 1: a.ts (8 changes) + b.ts (8 changes), co-occur 8 times => 100%
    // Pair 2: a.ts (8 changes) + c.ts (5 changes), co-occur 4 times => 4/5 = 80%
    // Wait — c.ts needs 5 changes minimum and 4/5=80% > 60%, so it qualifies
    const commits = [
      ...Array.from({ length: 4 }, (_, i) => ({
        hash: `abc${i}`,
        author: 'Alice',
        message: 'feat: all three',
        files: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        hash: `ab${i}`,
        author: 'Alice',
        message: 'feat: a and b',
        files: ['src/a.ts', 'src/b.ts'],
      })),
      { hash: 'c0', author: 'Alice', message: 'feat: c solo', files: ['src/c.ts'] },
    ];
    const raw = buildRawLog(commits);
    const git = createMockGit(raw);

    const result = await getFileCouplings(git, since);

    // a.ts = 8, b.ts = 8, c.ts = 5
    // a-b: co=8, pct = 8/min(8,8) = 100%
    // a-c: co=4, pct = 4/min(8,5) = 80%
    // b-c: co=4, pct = 4/min(8,5) = 80%
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]!.percentage).toBe(100);
    // Subsequent entries should have lower or equal percentage
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.percentage).toBeLessThanOrEqual(result[i - 1]!.percentage);
    }
  });

  it('returns empty array for no commits', async () => {
    const git = createMockGit('');

    const result = await getFileCouplings(git, since);

    expect(result).toEqual([]);
  });

  it('returns empty array when all files have fewer than 5 changes', async () => {
    const commits = [
      { hash: 'c0', author: 'Alice', message: 'feat: a', files: ['src/a.ts', 'src/b.ts'] },
      { hash: 'c1', author: 'Alice', message: 'feat: b', files: ['src/a.ts', 'src/b.ts'] },
      { hash: 'c2', author: 'Alice', message: 'feat: c', files: ['src/a.ts', 'src/b.ts'] },
    ];
    const raw = buildRawLog(commits);
    const git = createMockGit(raw);

    const result = await getFileCouplings(git, since);

    expect(result).toEqual([]);
  });

  it('handles single-file commits without errors', async () => {
    // Single-file commits should not create any pairs
    const commits = Array.from({ length: 10 }, (_, i) => ({
      hash: `c${i}`,
      author: 'Alice',
      message: 'feat: solo',
      files: ['src/auth.ts'],
    }));
    const raw = buildRawLog(commits);
    const git = createMockGit(raw);

    const result = await getFileCouplings(git, since);

    expect(result).toEqual([]);
  });
});
