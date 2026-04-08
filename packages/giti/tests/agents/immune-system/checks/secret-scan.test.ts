import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGit, simpleGitFactory } = vi.hoisted(() => {
  const mockGit = { diff: vi.fn() };
  const simpleGitFactory = vi.fn().mockReturnValue(mockGit);
  return { mockGit, simpleGitFactory };
});

vi.mock('simple-git', () => ({ default: simpleGitFactory }));

import { runSecretScan } from '../../../../src/agents/immune-system/checks/secret-scan.js';

describe('runSecretScan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    simpleGitFactory.mockReturnValue(mockGit);
  });

  it('passes when diff has no secrets', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/src/utils.ts\n+export function add(a: number, b: number) {\n+  return a + b;\n+}\n',
    );

    const result = await runSecretScan('/repo', 'feature/safe');

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Secrets');
    expect(result.message).toBe('No secrets detected');
  });

  it('fails when AWS access key detected', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/src/config.ts\n+const key = "AKIAIOSFODNN7EXAMPLE";\n',
    );

    const result = await runSecretScan('/repo', 'feature/aws');

    expect(result.status).toBe('fail');
    expect(result.message).toContain('AWS Access Key');
  });

  it('fails when private key header detected', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/certs/key.pem\n+-----BEGIN RSA PRIVATE KEY-----\n+MIIEowIBAAKC...\n',
    );

    const result = await runSecretScan('/repo', 'feature/cert');

    expect(result.status).toBe('fail');
    expect(result.message).toContain('Private Key');
  });

  it('fails when GitHub token detected', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/src/auth.ts\n+const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";\n',
    );

    const result = await runSecretScan('/repo', 'feature/gh-token');

    expect(result.status).toBe('fail');
    expect(result.message).toContain('GitHub Token');
  });

  it('fails when Slack token detected', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/src/slack.ts\n+const slackToken = "xoxb-1234567890-abcdefghij";\n',
    );

    const result = await runSecretScan('/repo', 'feature/slack');

    expect(result.status).toBe('fail');
    expect(result.message).toContain('Slack Token');
  });

  it('fails when URL with embedded password detected', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/src/db.ts\n+const db = "postgres://admin:s3cret@localhost:5432/mydb";\n',
    );

    const result = await runSecretScan('/repo', 'feature/db-url');

    expect(result.status).toBe('fail');
    expect(result.message).toContain('URL Password');
  });

  it('fails when generic api_key assignment detected', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/src/config.ts\n+const api_key = "sk_live_abcdefghij1234567890";\n',
    );

    const result = await runSecretScan('/repo', 'feature/api-key');

    expect(result.status).toBe('fail');
    expect(result.message).toContain('Generic API Key');
  });

  it('ignores removed lines (only scans additions)', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/src/config.ts\n-const key = "AKIAIOSFODNN7EXAMPLE";\n+const key = process.env.AWS_KEY;\n',
    );

    const result = await runSecretScan('/repo', 'feature/fix-secret');

    expect(result.status).toBe('pass');
    expect(result.message).toBe('No secrets detected');
  });

  it('passes when diff is empty', async () => {
    mockGit.diff.mockResolvedValueOnce('');

    const result = await runSecretScan('/repo', 'feature/empty');

    expect(result.status).toBe('pass');
    expect(result.message).toBe('No changes to scan');
  });

  it('passes gracefully when diff command fails', async () => {
    mockGit.diff.mockRejectedValueOnce(new Error('branch not found'));

    const result = await runSecretScan('/repo', 'feature/nonexistent');

    expect(result.status).toBe('pass');
    expect(result.message).toBe('Could not compute diff');
  });

  it('includes masked preview in details (should NOT contain full secret)', async () => {
    mockGit.diff.mockResolvedValueOnce(
      '+++ b/src/config.ts\n+const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";\n',
    );

    const result = await runSecretScan('/repo', 'feature/gh-token');

    expect(result.status).toBe('fail');
    expect(result.details).toBeDefined();
    expect(result.details!['masked_match']).toBeDefined();

    const masked = result.details!['masked_match'] as string;
    // Should NOT contain the full secret
    expect(masked).not.toContain('ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789');
    // Should contain partial mask
    expect(masked).toContain('***');
  });
});
