import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mocks ─────────────────────────────────────────────────────────

const mockGetConsecutiveFailures = vi.fn().mockResolvedValue(0);
const mockGetApiUsage = vi.fn().mockResolvedValue(null);
const mockIsKillSwitchActive = vi.fn().mockResolvedValue(false);
const mockIsInCooldown = vi.fn().mockResolvedValue(false);

vi.mock('../../../src/agents/orchestrator/safety.js', () => ({
  getConsecutiveFailures: (...args: unknown[]) => mockGetConsecutiveFailures(...args),
  getApiUsage: (...args: unknown[]) => mockGetApiUsage(...args),
  isKillSwitchActive: (...args: unknown[]) => mockIsKillSwitchActive(...args),
  isInCooldown: (...args: unknown[]) => mockIsInCooldown(...args),
}));

const mockGetSchedulerStatus = vi.fn().mockResolvedValue(null);

vi.mock('../../../src/agents/orchestrator/scheduler.js', () => ({
  getSchedulerStatus: (...args: unknown[]) => mockGetSchedulerStatus(...args),
}));

const mockReadJsonFile = vi.fn().mockResolvedValue(null);
const mockGetOrganismPath = vi.fn().mockImplementation((...args: string[]) => args.join('/'));

vi.mock('../../../src/agents/utils.js', () => ({
  readJsonFile: (...args: unknown[]) => mockReadJsonFile(...args),
  getOrganismPath: (...args: unknown[]) => mockGetOrganismPath(...args),
}));

const mockReaddir = vi.fn().mockResolvedValue([]);

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
  },
}));

import { getOrganismStatus } from '../../../src/agents/orchestrator/index.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset defaults
  mockGetConsecutiveFailures.mockResolvedValue(0);
  mockGetApiUsage.mockResolvedValue(null);
  mockIsKillSwitchActive.mockResolvedValue(false);
  mockIsInCooldown.mockResolvedValue(false);
  mockGetSchedulerStatus.mockResolvedValue(null);
  mockReadJsonFile.mockResolvedValue(null);
  mockReaddir.mockResolvedValue([]);
});

describe('getOrganismStatus', () => {
  it('returns stopped state when kill switch is active', async () => {
    mockIsKillSwitchActive.mockResolvedValue(true);
    const result = await getOrganismStatus('/repo');
    expect(result.state).toBe('stopped');
  });

  it('returns paused state when 3+ consecutive failures', async () => {
    mockGetConsecutiveFailures.mockResolvedValue(3);
    const result = await getOrganismStatus('/repo');
    expect(result.state).toBe('paused');
  });

  it('returns cooldown state when in cooldown', async () => {
    mockIsInCooldown.mockResolvedValue(true);
    const result = await getOrganismStatus('/repo');
    expect(result.state).toBe('cooldown');
  });

  it('returns running state when scheduler is active', async () => {
    mockGetSchedulerStatus.mockResolvedValue({
      pid: 1234,
      interval_ms: 60000,
      started_at: new Date().toISOString(),
      repo_path: '/repo',
    });
    const result = await getOrganismStatus('/repo');
    expect(result.state).toBe('running');
    expect(result.next_cycle_at).not.toBeNull();
  });

  it('returns stopped state by default', async () => {
    const result = await getOrganismStatus('/repo');
    expect(result.state).toBe('stopped');
    expect(result.total_cycles).toBe(0);
    expect(result.total_changes_merged).toBe(0);
    expect(result.total_changes_rejected).toBe(0);
    expect(result.consecutive_failures).toBe(0);
    expect(result.next_cycle_at).toBeNull();
  });

  it('loads cycle history from directory', async () => {
    mockReaddir.mockResolvedValue(['cycle-1.json', 'cycle-2.json']);
    mockReadJsonFile
      .mockResolvedValueOnce(null)  // cooldown file
      .mockResolvedValueOnce({ changes_merged: 2, changes_rejected: 1 }) // cycle-2
      .mockResolvedValueOnce({ changes_merged: 1, changes_rejected: 0 }) // cycle-1
      .mockResolvedValueOnce({ count: 5 }); // cycle-counter

    const result = await getOrganismStatus('/repo');
    expect(result.total_cycles).toBe(5);
  });

  it('uses API usage data when available', async () => {
    mockGetApiUsage.mockResolvedValue({ total_tokens: 5000, budget: 50000 });
    const result = await getOrganismStatus('/repo');
    expect(result.total_api_tokens).toBe(5000);
    expect(result.api_budget).toBe(50000);
  });

  it('handles missing cycle history directory', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
    const result = await getOrganismStatus('/repo');
    expect(result.total_cycles).toBe(0);
  });
});
