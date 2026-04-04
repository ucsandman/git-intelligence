import { Octokit } from '@octokit/rest';
import type { GitHubConfig, PRParams, PRResult } from './types.js';

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  async createPullRequest(params: PRParams): Promise<PRResult> {
    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      head: params.branch,
      base: params.base ?? 'main',
      title: params.title,
      body: params.body,
    });

    if (params.labels.length > 0) {
      await this.octokit.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: data.number,
        labels: params.labels,
      });
    }

    return { number: data.number, url: data.html_url };
  }

  async mergePullRequest(
    prNumber: number,
    method: 'merge' | 'squash' | 'rebase' = 'squash',
  ): Promise<void> {
    await this.octokit.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      merge_method: method,
    });
  }

  async closePullRequest(prNumber: number, comment?: string): Promise<void> {
    if (comment) {
      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        body: comment,
      });
    }

    await this.octokit.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      state: 'closed',
    });
  }

  async createComment(issueNumber: number, body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body,
    });
  }

  async createRelease(tag: string, name: string, body: string): Promise<string> {
    const { data } = await this.octokit.repos.createRelease({
      owner: this.owner,
      repo: this.repo,
      tag_name: tag,
      name,
      body,
    });
    return data.html_url;
  }

  async getOpenIssues(): Promise<Array<{ number: number; title: string; body: string; labels: string[] }>> {
    const { data } = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state: 'open',
      per_page: 50,
    });

    return data
      .filter(i => !i.pull_request)
      .map(i => ({
        number: i.number,
        title: i.title,
        body: i.body ?? '',
        labels: i.labels.map(l => (typeof l === 'string' ? l : l.name ?? '')),
      }));
  }
}

export function createGitHubClient(): GitHubClient | null {
  const token = process.env['GITHUB_TOKEN'];
  const owner = process.env['GITHUB_OWNER'];
  const repo = process.env['GITHUB_REPO'];

  if (!token || !owner || !repo) return null;

  return new GitHubClient({
    token,
    owner,
    repo,
    auto_merge: process.env['GITI_AUTO_MERGE'] === 'true',
    auto_merge_delay_ms: parseInt(process.env['GITI_AUTO_MERGE_DELAY'] ?? '3600000', 10),
  });
}
