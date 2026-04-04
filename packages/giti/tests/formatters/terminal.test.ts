import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PulseResult, HotspotsResult, GhostsResult } from '../../src/types/index.js';

// Mock formatRelativeTime so tests are deterministic
vi.mock('../../src/utils/time.js', () => ({
  formatRelativeTime: vi.fn((date: Date) => '2d ago'),
}));

import { formatPulse, formatHotspots, formatGhosts } from '../../src/formatters/terminal.js';

function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('formatPulse', () => {
  const basePulseResult: PulseResult = {
    repoName: 'my-project',
    lastCommit: {
      date: new Date('2026-04-02T10:00:00Z'),
      message: 'fix: resolve auth bug in middleware',
      author: 'Alice',
    },
    weeklyCommits: { count: 42, authorCount: 5 },
    branches: { active: 3, stale: 2 },
    hottestFile: { path: 'src/auth.ts', changeCount: 7 },
    testRatio: { testFiles: 10, sourceFiles: 50, percentage: 20 },
    avgCommitSize: 85,
    busFactor: { count: 2, topAuthorsPercentage: 78, topAuthorCount: 2 },
  };

  it('includes repo name in header', () => {
    const output = stripAnsi(formatPulse(basePulseResult));
    expect(output).toContain('Repository Pulse: my-project');
  });

  it('includes last commit info with relative time', () => {
    const output = stripAnsi(formatPulse(basePulseResult));
    expect(output).toContain('Last commit:');
    expect(output).toContain('2d ago');
    // message should be present (possibly truncated)
    expect(output).toContain('fix: resolve auth bug');
  });

  it('includes weekly commit count and author count', () => {
    const output = stripAnsi(formatPulse(basePulseResult));
    expect(output).toContain('42 commits by 5 authors');
  });

  it('includes branch counts', () => {
    const output = stripAnsi(formatPulse(basePulseResult));
    expect(output).toContain('Active branches:');
    expect(output).toContain('3');
    expect(output).toContain('2 stale');
  });

  it('includes hottest file info', () => {
    const output = stripAnsi(formatPulse(basePulseResult));
    expect(output).toContain('Hottest file:');
    expect(output).toContain('src/auth.ts');
    expect(output).toContain('7 times');
  });

  it('handles null hottestFile', () => {
    const result: PulseResult = { ...basePulseResult, hottestFile: null };
    const output = stripAnsi(formatPulse(result));
    expect(output).toContain('No file changes this week');
  });

  it('includes test ratio', () => {
    const output = stripAnsi(formatPulse(basePulseResult));
    expect(output).toContain('Test ratio:');
    expect(output).toContain('10/50 files');
    expect(output).toContain('20%');
  });

  it('includes avg commit size', () => {
    const output = stripAnsi(formatPulse(basePulseResult));
    expect(output).toContain('Avg commit size:');
    expect(output).toContain('85 lines changed');
  });

  it('includes bus factor', () => {
    const output = stripAnsi(formatPulse(basePulseResult));
    expect(output).toContain('Bus factor:');
    expect(output).toContain('2');
    expect(output).toContain('78%');
  });
});

describe('formatHotspots', () => {
  const baseHotspotsResult: HotspotsResult = {
    period: '30 days',
    hotspots: [
      { filepath: 'src/auth.ts', changes: 15, authors: 4, bugFixes: 3 },
      { filepath: 'src/api/users.ts', changes: 12, authors: 3, bugFixes: 1 },
      { filepath: 'src/utils/helpers.ts', changes: 8, authors: 2, bugFixes: 0 },
    ],
    couplings: [
      { fileA: 'src/auth.ts', fileB: 'src/session.ts', percentage: 80, coOccurrences: 12 },
    ],
  };

  it('includes header with period', () => {
    const output = stripAnsi(formatHotspots(baseHotspotsResult));
    expect(output).toContain('Codebase Hotspots (last 30 days)');
  });

  it('lists hotspots with correct numbering', () => {
    const output = stripAnsi(formatHotspots(baseHotspotsResult));
    expect(output).toContain('1.');
    expect(output).toContain('src/auth.ts');
    expect(output).toContain('15 changes');
    expect(output).toContain('4 authors');
    expect(output).toContain('3 bug fixes');
    expect(output).toContain('2.');
    expect(output).toContain('src/api/users.ts');
    expect(output).toContain('3.');
    expect(output).toContain('src/utils/helpers.ts');
  });

  it('includes coupling section when couplings exist', () => {
    const output = stripAnsi(formatHotspots(baseHotspotsResult));
    expect(output).toContain('Coupling detected');
    expect(output).toContain('src/auth.ts');
    expect(output).toContain('src/session.ts');
    expect(output).toContain('80%');
    expect(output).toContain('12 co-occurrences');
  });

  it('omits coupling section when no couplings', () => {
    const result: HotspotsResult = { ...baseHotspotsResult, couplings: [] };
    const output = stripAnsi(formatHotspots(result));
    expect(output).not.toContain('Coupling detected');
  });
});

describe('formatGhosts', () => {
  const baseGhostsResult: GhostsResult = {
    staleBranches: [
      {
        name: 'feature/old-login',
        lastCommitDate: new Date('2026-01-15T10:00:00Z'),
        author: 'Alice',
        aheadOfMain: 45,
        commitCount: 3,
      },
    ],
    deadCode: [
      {
        filepath: 'src/legacy/parser.ts',
        lastModified: new Date('2025-10-01T10:00:00Z'),
        importedByCount: 1,
      },
    ],
  };

  it('includes header', () => {
    const output = stripAnsi(formatGhosts(baseGhostsResult));
    expect(output).toContain('Abandoned Work');
  });

  it('includes stale branches section', () => {
    const output = stripAnsi(formatGhosts(baseGhostsResult));
    expect(output).toContain('Stale branches');
    expect(output).toContain('feature/old-login');
    expect(output).toContain('2d ago');
    expect(output).toContain('@Alice');
    expect(output).toContain('45 lines ahead');
  });

  it('includes dead code section', () => {
    const output = stripAnsi(formatGhosts(baseGhostsResult));
    expect(output).toContain('Dead code signals');
    expect(output).toContain('src/legacy/parser.ts');
    expect(output).toContain('2d ago');
    expect(output).toContain('1 files');
  });

  it('shows summary line always', () => {
    const output = stripAnsi(formatGhosts(baseGhostsResult));
    expect(output).toContain('Summary:');
    expect(output).toContain('1 stale branches');
    expect(output).toContain('1 potential dead files');
  });

  it('handles empty results (no stale branches, no dead code)', () => {
    const emptyResult: GhostsResult = { staleBranches: [], deadCode: [] };
    const output = stripAnsi(formatGhosts(emptyResult));
    expect(output).toContain('Abandoned Work');
    expect(output).not.toContain('Stale branches');
    expect(output).not.toContain('Dead code signals');
    expect(output).toContain('Summary:');
    expect(output).toContain('0 stale branches');
    expect(output).toContain('0 potential dead files');
  });

  it('uses custom mainBranch parameter', () => {
    const output = stripAnsi(formatGhosts(baseGhostsResult, 'develop'));
    expect(output).toContain('ahead of develop');
  });

  it('defaults mainBranch to "main"', () => {
    const output = stripAnsi(formatGhosts(baseGhostsResult));
    expect(output).toContain('ahead of main');
  });
});
