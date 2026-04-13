import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGit = vi.hoisted(() => ({
  checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue({ commit: 'abc123' }),
  branch: vi.fn().mockResolvedValue({ all: ['main', 'develop'] }),
  checkout: vi.fn().mockResolvedValue(undefined),
  merge: vi.fn().mockResolvedValue(undefined),
  deleteLocalBranch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('simple-git', () => ({
  default: vi.fn().mockReturnValue(mockGit),
}));

import {
  createBranch,
  commitChanges,
  switchToMain,
  mergeBranch,
  deleteBranch,
  generateBranchName,
  formatCommitMessage,
} from '../../../src/agents/motor-cortex/branch-manager.js';

describe('branch-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBranch', () => {
    it('calls git.checkoutLocalBranch with the correct branch name', async () => {
      await createBranch('/repo', 'organism/motor/fix-bug');
      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('organism/motor/fix-bug');
    });
  });

  describe('commitChanges', () => {
    it('calls git.add then git.commit and returns the commit hash', async () => {
      const hash = await commitChanges('/repo', 'fix: something', ['src/a.ts', 'src/b.ts']);
      expect(mockGit.add).toHaveBeenCalledWith(['src/a.ts', 'src/b.ts']);
      expect(mockGit.commit).toHaveBeenCalledWith('fix: something');
      expect(hash).toBe('abc123');
    });
  });

  describe('switchToMain', () => {
    it('detects main from branch list and checks it out', async () => {
      mockGit.branch.mockResolvedValueOnce({ all: ['main', 'develop'] });
      await switchToMain('/repo');
      expect(mockGit.checkout).toHaveBeenCalledWith('main');
    });

    it('falls back to master when main is not present', async () => {
      mockGit.branch.mockResolvedValueOnce({ all: ['master', 'feature/x'] });
      await switchToMain('/repo');
      expect(mockGit.checkout).toHaveBeenCalledWith('master');
    });
  });

  describe('mergeBranch', () => {
    it('calls git.merge with --no-ff', async () => {
      await mergeBranch('/repo', 'organism/motor/fix-bug');
      expect(mockGit.merge).toHaveBeenCalledWith(['organism/motor/fix-bug', '--no-ff']);
    });
  });

  describe('deleteBranch', () => {
    it('calls git.deleteLocalBranch with force=true', async () => {
      await deleteBranch('/repo', 'organism/motor/fix-bug');
      expect(mockGit.deleteLocalBranch).toHaveBeenCalledWith('organism/motor/fix-bug', true);
    });
  });

  describe('generateBranchName', () => {
    it('creates correct slug from title with cycle suffix', () => {
      expect(generateBranchName('Fix performance regression', 37)).toBe(
        'organism/motor/fix-performance-regression-c37',
      );
    });

    it('handles special characters', () => {
      expect(generateBranchName('Add feature: cool stuff! (v2)', 1)).toBe(
        'organism/motor/add-feature-cool-stuff-v2-c1',
      );
    });

    it('truncates slug at 50 characters (cycle suffix appended after)', () => {
      const longTitle =
        'This is a very long title that should be truncated to fifty characters in the slug portion';
      const branch = generateBranchName(longTitle, 99);
      // Slug portion (before -c<cycle>) should be <= 50 chars
      const slug = branch.replace('organism/motor/', '').replace(/-c\d+$/, '');
      expect(slug.length).toBeLessThanOrEqual(50);
      expect(slug).not.toMatch(/-$/);
      expect(branch).toMatch(/-c99$/);
    });

    it('strips leading and trailing hyphens from slug', () => {
      expect(generateBranchName('---leading-trailing---', 5)).toBe(
        'organism/motor/leading-trailing-c5',
      );
    });

    it('produces distinct names for same title across cycles', () => {
      const a = generateBranchName('Fix failing tests', 37);
      const b = generateBranchName('Fix failing tests', 38);
      expect(a).not.toBe(b);
    });
  });

  describe('formatCommitMessage', () => {
    it('includes all fields in correct format', () => {
      const msg = formatCommitMessage(
        'Fix memory leak',
        'WI-001',
        2,
        5,
        'Fixed a memory leak in the cache module.',
        'Repeated OOM errors observed in production.',
      );

      expect(msg).toBe(
        [
          'organism(motor): Fix memory leak',
          '',
          'Work item: WI-001',
          'Tier: 2',
          'Cycle: 5',
          '',
          'Fixed a memory leak in the cache module.',
          '',
          'Rationale: Repeated OOM errors observed in production.',
        ].join('\n'),
      );
    });
  });
});
