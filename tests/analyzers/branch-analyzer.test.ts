import { describe, it, expect, vi } from 'vitest';
import type { SimpleGit } from 'simple-git';

import {
  getBranchStats,
  getStaleBranches,
} from '../../src/analyzers/branch-analyzer.js';

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function createMockGit(
  branches: string[],
  branchDates: Record<string, string>,
  aheadCounts: Record<string, string> = {},
): SimpleGit {
  return {
    branch: vi.fn().mockResolvedValue({
      all: branches,
      current: 'main',
      branches: Object.fromEntries(
        branches.map((b) => [
          b,
          { current: b === 'main', name: b, commit: 'abc', label: '' },
        ]),
      ),
    }),
    raw: vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === 'rev-list') {
        const ref = args[2] ?? '';
        const branch = ref.split('..')[1] ?? '';
        return Promise.resolve(aheadCounts[branch] ?? '0');
      }
      if (args[0] === 'log') {
        // args: ['log', '-1', '--format=%aI', branchName]
        const branchName = args[3] ?? '';
        const date = branchDates[branchName] ?? new Date().toISOString();
        return Promise.resolve(date);
      }
      return Promise.resolve('');
    }),
    log: vi.fn().mockImplementation((options: Record<string, unknown>) => {
      const branchName = Object.keys(options).find(
        (k) => k !== 'maxCount' && k !== '--format',
      );
      const date =
        branchDates[branchName ?? ''] ?? new Date().toISOString();
      return Promise.resolve({
        all: [
          {
            hash: 'abc',
            date,
            message: 'msg',
            author_name: 'Author',
          },
        ],
        total: 1,
        latest: {
          hash: 'abc',
          date,
          message: 'msg',
          author_name: 'Author',
        },
      });
    }),
  } as unknown as SimpleGit;
}

// ---- getBranchStats ----

describe('getBranchStats', () => {
  it('counts active and stale correctly', async () => {
    const git = createMockGit(
      ['main', 'feature-a', 'feature-b', 'old-branch'],
      {
        main: daysAgo(1),
        'feature-a': daysAgo(5),
        'feature-b': daysAgo(10),
        'old-branch': daysAgo(60),
      },
    );

    const result = await getBranchStats(git, 30);

    // main, feature-a, feature-b are active (< 30 days)
    // old-branch is stale (60 days)
    expect(result.active).toBe(3);
    expect(result.stale).toBe(1);
  });

  it('returns 0 stale when all branches are fresh', async () => {
    const git = createMockGit(
      ['main', 'feature-a', 'feature-b'],
      {
        main: daysAgo(1),
        'feature-a': daysAgo(2),
        'feature-b': daysAgo(5),
      },
    );

    const result = await getBranchStats(git, 30);

    expect(result.active).toBe(3);
    expect(result.stale).toBe(0);
  });

  it('returns all stale when all branches are old', async () => {
    const git = createMockGit(
      ['main', 'old-a', 'old-b'],
      {
        main: daysAgo(90),
        'old-a': daysAgo(60),
        'old-b': daysAgo(120),
      },
    );

    const result = await getBranchStats(git, 30);

    expect(result.active).toBe(0);
    expect(result.stale).toBe(3);
  });

  it('respects custom staleDays threshold', async () => {
    const git = createMockGit(
      ['main', 'feature-a', 'old-branch'],
      {
        main: daysAgo(1),
        'feature-a': daysAgo(10),
        'old-branch': daysAgo(15),
      },
    );

    // With staleDays=7, feature-a (10 days) and old-branch (15 days) are stale
    const result = await getBranchStats(git, 7);

    expect(result.active).toBe(1);
    expect(result.stale).toBe(2);
  });

  it('uses default staleDays of 30 when not specified', async () => {
    const git = createMockGit(
      ['main', 'recent', 'old'],
      {
        main: daysAgo(1),
        recent: daysAgo(20),
        old: daysAgo(45),
      },
    );

    const result = await getBranchStats(git);

    expect(result.active).toBe(2);
    expect(result.stale).toBe(1);
  });
});

// ---- getStaleBranches ----

describe('getStaleBranches', () => {
  it('returns correct details for stale branches', async () => {
    const staleDate = daysAgo(60);
    const git = createMockGit(
      ['main', 'feature-a', 'stale-branch'],
      {
        main: daysAgo(1),
        'feature-a': daysAgo(5),
        'stale-branch': staleDate,
      },
      { 'stale-branch': '5' },
    );

    const result = await getStaleBranches(git, 'main', 30);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('stale-branch');
    expect(result[0]!.lastCommitDate).toEqual(new Date(staleDate));
    expect(result[0]!.author).toBe('Author');
    expect(result[0]!.aheadOfMain).toBe(5);
    expect(result[0]!.commitCount).toBe(5);
  });

  it('excludes main branch from stale detection', async () => {
    const git = createMockGit(
      ['main', 'stale-a'],
      {
        main: daysAgo(90), // main is old but should be excluded
        'stale-a': daysAgo(60),
      },
      { 'stale-a': '3' },
    );

    const result = await getStaleBranches(git, 'main', 30);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('stale-a');
    // main should NOT appear even though it's old
    expect(result.find((b) => b.name === 'main')).toBeUndefined();
  });

  it('excludes HEAD from stale detection', async () => {
    const git = createMockGit(
      ['main', 'HEAD', 'stale-a'],
      {
        main: daysAgo(1),
        HEAD: daysAgo(90),
        'stale-a': daysAgo(60),
      },
      { 'stale-a': '2' },
    );

    const result = await getStaleBranches(git, 'main', 30);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('stale-a');
    expect(result.find((b) => b.name === 'HEAD')).toBeUndefined();
  });

  it('sorts by lastCommitDate ascending (oldest first)', async () => {
    const git = createMockGit(
      ['main', 'stale-newer', 'stale-oldest', 'stale-middle'],
      {
        main: daysAgo(1),
        'stale-newer': daysAgo(40),
        'stale-oldest': daysAgo(120),
        'stale-middle': daysAgo(60),
      },
      {
        'stale-newer': '1',
        'stale-oldest': '10',
        'stale-middle': '5',
      },
    );

    const result = await getStaleBranches(git, 'main', 30);

    expect(result).toHaveLength(3);
    expect(result[0]!.name).toBe('stale-oldest');
    expect(result[1]!.name).toBe('stale-middle');
    expect(result[2]!.name).toBe('stale-newer');
  });

  it('returns empty array when no stale branches exist', async () => {
    const git = createMockGit(
      ['main', 'feature-a', 'feature-b'],
      {
        main: daysAgo(1),
        'feature-a': daysAgo(5),
        'feature-b': daysAgo(10),
      },
    );

    const result = await getStaleBranches(git, 'main', 30);

    expect(result).toEqual([]);
  });

  it('uses default staleDays of 30 when not specified', async () => {
    const git = createMockGit(
      ['main', 'fresh', 'stale'],
      {
        main: daysAgo(1),
        fresh: daysAgo(20),
        stale: daysAgo(45),
      },
      { stale: '2' },
    );

    const result = await getStaleBranches(git, 'main');

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('stale');
  });

  it('excludes master branch when it is the main branch', async () => {
    const git = createMockGit(
      ['master', 'stale-a'],
      {
        master: daysAgo(90),
        'stale-a': daysAgo(60),
      },
      { 'stale-a': '4' },
    );

    const result = await getStaleBranches(git, 'master', 30);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('stale-a');
    expect(result.find((b) => b.name === 'master')).toBeUndefined();
  });
});
