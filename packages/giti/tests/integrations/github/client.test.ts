import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient, createGitHubClient } from '../../../src/integrations/github/client.js';
import type { GitHubConfig, PRParams } from '../../../src/integrations/github/types.js';

// ── Mock Octokit ───────────────────────────────────────────────────────

const mockPullsCreate = vi.fn();
const mockPullsMerge = vi.fn();
const mockPullsUpdate = vi.fn();
const mockIssuesAddLabels = vi.fn();
const mockIssuesCreateComment = vi.fn();
const mockIssuesListForRepo = vi.fn();
const mockReposCreateRelease = vi.fn();

vi.mock('@octokit/rest', () => {
  return {
    Octokit: class MockOctokit {
      pulls = {
        create: mockPullsCreate,
        merge: mockPullsMerge,
        update: mockPullsUpdate,
      };
      issues = {
        addLabels: mockIssuesAddLabels,
        createComment: mockIssuesCreateComment,
        listForRepo: mockIssuesListForRepo,
      };
      repos = {
        createRelease: mockReposCreateRelease,
      };
    },
  };
});

// ── Helpers ─────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<GitHubConfig> = {}): GitHubConfig {
  return {
    token: overrides.token ?? 'ghp_test_token',
    owner: overrides.owner ?? 'test-owner',
    repo: overrides.repo ?? 'test-repo',
    auto_merge: overrides.auto_merge ?? false,
    auto_merge_delay_ms: overrides.auto_merge_delay_ms ?? 3600000,
  };
}

function makePRParams(overrides: Partial<PRParams> = {}): PRParams {
  return {
    branch: overrides.branch ?? 'feature/test',
    title: overrides.title ?? 'Test PR',
    body: overrides.body ?? 'Test body',
    labels: overrides.labels ?? [],
    base: overrides.base,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient(makeConfig());
  });

  // ── createPullRequest ───────────────────────────────────────────────

  describe('createPullRequest', () => {
    it('calls pulls.create with correct params', async () => {
      mockPullsCreate.mockResolvedValue({
        data: { number: 42, html_url: 'https://github.com/test-owner/test-repo/pull/42' },
      });

      const result = await client.createPullRequest(
        makePRParams({ branch: 'feat/new', title: 'New Feature', body: 'Description' }),
      );

      expect(mockPullsCreate).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        head: 'feat/new',
        base: 'main',
        title: 'New Feature',
        body: 'Description',
      });
      expect(result).toEqual({
        number: 42,
        url: 'https://github.com/test-owner/test-repo/pull/42',
      });
    });

    it('uses custom base branch when provided', async () => {
      mockPullsCreate.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/o/r/pull/1' },
      });

      await client.createPullRequest(makePRParams({ base: 'develop' }));

      expect(mockPullsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ base: 'develop' }),
      );
    });

    it('adds labels when labels array is non-empty', async () => {
      mockPullsCreate.mockResolvedValue({
        data: { number: 10, html_url: 'https://github.com/o/r/pull/10' },
      });

      await client.createPullRequest(
        makePRParams({ labels: ['bug', 'urgent'] }),
      );

      expect(mockIssuesAddLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 10,
        labels: ['bug', 'urgent'],
      });
    });

    it('skips addLabels when labels array is empty', async () => {
      mockPullsCreate.mockResolvedValue({
        data: { number: 5, html_url: 'https://github.com/o/r/pull/5' },
      });

      await client.createPullRequest(makePRParams({ labels: [] }));

      expect(mockIssuesAddLabels).not.toHaveBeenCalled();
    });
  });

  // ── mergePullRequest ────────────────────────────────────────────────

  describe('mergePullRequest', () => {
    it('calls pulls.merge with squash by default', async () => {
      mockPullsMerge.mockResolvedValue({ data: {} });

      await client.mergePullRequest(42);

      expect(mockPullsMerge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 42,
        merge_method: 'squash',
      });
    });

    it('supports rebase merge method', async () => {
      mockPullsMerge.mockResolvedValue({ data: {} });

      await client.mergePullRequest(7, 'rebase');

      expect(mockPullsMerge).toHaveBeenCalledWith(
        expect.objectContaining({ merge_method: 'rebase' }),
      );
    });

    it('supports merge merge method', async () => {
      mockPullsMerge.mockResolvedValue({ data: {} });

      await client.mergePullRequest(7, 'merge');

      expect(mockPullsMerge).toHaveBeenCalledWith(
        expect.objectContaining({ merge_method: 'merge' }),
      );
    });
  });

  // ── closePullRequest ────────────────────────────────────────────────

  describe('closePullRequest', () => {
    it('closes PR without comment when none given', async () => {
      mockPullsUpdate.mockResolvedValue({ data: {} });

      await client.closePullRequest(15);

      expect(mockIssuesCreateComment).not.toHaveBeenCalled();
      expect(mockPullsUpdate).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 15,
        state: 'closed',
      });
    });

    it('adds comment before closing when comment provided', async () => {
      mockIssuesCreateComment.mockResolvedValue({ data: {} });
      mockPullsUpdate.mockResolvedValue({ data: {} });

      await client.closePullRequest(15, 'Closing as duplicate');

      expect(mockIssuesCreateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 15,
        body: 'Closing as duplicate',
      });
      expect(mockPullsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed' }),
      );
    });
  });

  // ── createComment ───────────────────────────────────────────────────

  describe('createComment', () => {
    it('calls issues.createComment with correct params', async () => {
      mockIssuesCreateComment.mockResolvedValue({ data: {} });

      await client.createComment(99, 'Great work!');

      expect(mockIssuesCreateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 99,
        body: 'Great work!',
      });
    });
  });

  // ── createRelease ───────────────────────────────────────────────────

  describe('createRelease', () => {
    it('calls repos.createRelease and returns URL', async () => {
      mockReposCreateRelease.mockResolvedValue({
        data: { html_url: 'https://github.com/o/r/releases/tag/v1.0.0' },
      });

      const url = await client.createRelease('v1.0.0', 'Release 1.0.0', 'Changelog content');

      expect(mockReposCreateRelease).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        tag_name: 'v1.0.0',
        name: 'Release 1.0.0',
        body: 'Changelog content',
      });
      expect(url).toBe('https://github.com/o/r/releases/tag/v1.0.0');
    });
  });

  // ── getOpenIssues ───────────────────────────────────────────────────

  describe('getOpenIssues', () => {
    it('returns issues excluding pull requests', async () => {
      mockIssuesListForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Bug report',
            body: 'Something broke',
            labels: [{ name: 'bug' }],
            pull_request: undefined,
          },
          {
            number: 2,
            title: 'PR title',
            body: 'PR body',
            labels: [],
            pull_request: { url: 'https://...' },
          },
          {
            number: 3,
            title: 'Feature request',
            body: null,
            labels: ['enhancement', { name: 'good first issue' }],
            pull_request: undefined,
          },
        ],
      });

      const issues = await client.getOpenIssues();

      expect(issues).toHaveLength(2);
      expect(issues[0]).toEqual({
        number: 1,
        title: 'Bug report',
        body: 'Something broke',
        labels: ['bug'],
      });
      expect(issues[1]).toEqual({
        number: 3,
        title: 'Feature request',
        body: '',
        labels: ['enhancement', 'good first issue'],
      });
    });

    it('calls listForRepo with correct params', async () => {
      mockIssuesListForRepo.mockResolvedValue({ data: [] });

      await client.getOpenIssues();

      expect(mockIssuesListForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        per_page: 50,
      });
    });

    it('handles labels that are plain strings', async () => {
      mockIssuesListForRepo.mockResolvedValue({
        data: [
          {
            number: 5,
            title: 'Test',
            body: 'body',
            labels: ['string-label'],
            pull_request: undefined,
          },
        ],
      });

      const issues = await client.getOpenIssues();

      expect(issues[0]!.labels).toEqual(['string-label']);
    });

    it('handles labels with missing name', async () => {
      mockIssuesListForRepo.mockResolvedValue({
        data: [
          {
            number: 6,
            title: 'Test',
            body: 'body',
            labels: [{ name: undefined }],
            pull_request: undefined,
          },
        ],
      });

      const issues = await client.getOpenIssues();

      expect(issues[0]!.labels).toEqual(['']);
    });
  });
});

// ── createGitHubClient ────────────────────────────────────────────────

describe('createGitHubClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when GITHUB_TOKEN is missing', () => {
    delete process.env['GITHUB_TOKEN'];
    process.env['GITHUB_OWNER'] = 'owner';
    process.env['GITHUB_REPO'] = 'repo';

    expect(createGitHubClient()).toBeNull();
  });

  it('returns null when GITHUB_OWNER is missing', () => {
    process.env['GITHUB_TOKEN'] = 'token';
    delete process.env['GITHUB_OWNER'];
    process.env['GITHUB_REPO'] = 'repo';

    expect(createGitHubClient()).toBeNull();
  });

  it('returns null when GITHUB_REPO is missing', () => {
    process.env['GITHUB_TOKEN'] = 'token';
    process.env['GITHUB_OWNER'] = 'owner';
    delete process.env['GITHUB_REPO'];

    expect(createGitHubClient()).toBeNull();
  });

  it('returns GitHubClient when all env vars are set', () => {
    process.env['GITHUB_TOKEN'] = 'ghp_test';
    process.env['GITHUB_OWNER'] = 'test-owner';
    process.env['GITHUB_REPO'] = 'test-repo';

    const client = createGitHubClient();
    expect(client).toBeInstanceOf(GitHubClient);
  });

  it('reads auto_merge from GITI_AUTO_MERGE env var', () => {
    process.env['GITHUB_TOKEN'] = 'ghp_test';
    process.env['GITHUB_OWNER'] = 'owner';
    process.env['GITHUB_REPO'] = 'repo';
    process.env['GITI_AUTO_MERGE'] = 'true';

    const client = createGitHubClient();
    expect(client).toBeInstanceOf(GitHubClient);
  });

  it('returns null when all env vars are empty strings', () => {
    process.env['GITHUB_TOKEN'] = '';
    process.env['GITHUB_OWNER'] = '';
    process.env['GITHUB_REPO'] = '';

    expect(createGitHubClient()).toBeNull();
  });
});
