import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import type { TelemetryEvent } from '../../src/telemetry/types.js';

// ── mocks ──────────────────────────────────────────────────────────

vi.mock('../../src/telemetry/store.js', () => ({
  getUserConfig: vi.fn(),
  appendEvent: vi.fn(),
}));

vi.mock('../../src/telemetry/anonymizer.js', () => ({
  buildRepoCharacteristics: vi.fn(),
}));

vi.mock('../../src/utils/git.js', () => ({
  createGitClient: vi.fn(),
}));

vi.mock('../../src/agents/utils.js', () => ({
  readJsonFile: vi.fn(),
  ensureOrganismDir: vi.fn(),
  getOrganismPath: vi.fn(),
}));

import { recordCommandTelemetry, extractFlags } from '../../src/telemetry/collector.js';
import { getUserConfig, appendEvent } from '../../src/telemetry/store.js';
import { buildRepoCharacteristics } from '../../src/telemetry/anonymizer.js';
import { createGitClient } from '../../src/utils/git.js';
import { readJsonFile } from '../../src/agents/utils.js';

const mockGetUserConfig = vi.mocked(getUserConfig);
const mockAppendEvent = vi.mocked(appendEvent);
const mockBuildRepoCharacteristics = vi.mocked(buildRepoCharacteristics);
const mockCreateGitClient = vi.mocked(createGitClient);
const mockReadJsonFile = vi.mocked(readJsonFile);

// ── helpers ────────────────────────────────────────────────────────

const DEFAULT_CHARACTERISTICS = {
  commit_count_bucket: '100-1k',
  branch_count_bucket: '0-5',
  author_count_bucket: '2-5',
  primary_language: 'TypeScript',
  has_monorepo_structure: false,
  age_bucket: '1-6mo',
};

function setupEnabledMocks(): void {
  mockGetUserConfig.mockResolvedValue({ enabled: true, first_prompt_shown: true });
  mockCreateGitClient.mockReturnValue({} as ReturnType<typeof createGitClient>);
  mockBuildRepoCharacteristics.mockResolvedValue(DEFAULT_CHARACTERISTICS);
  mockReadJsonFile.mockResolvedValue({ version: '0.1.0' });
  mockAppendEvent.mockResolvedValue(undefined);
}

// ── recordCommandTelemetry ─────────────────────────────────────────

describe('recordCommandTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records event with all fields when telemetry is enabled', async () => {
    setupEnabledMocks();

    await recordCommandTelemetry('/repo', 'pulse', ['--json'], 250, 0);

    expect(mockAppendEvent).toHaveBeenCalledOnce();
    const event = mockAppendEvent.mock.calls[0]![1] as TelemetryEvent;

    expect(event.command).toBe('pulse');
    expect(event.flags_used).toEqual(['--json']);
    expect(event.execution_time_ms).toBe(250);
    expect(event.exit_code).toBe(0);
    expect(event.error_type).toBeUndefined();
    expect(event.repo_characteristics).toEqual(DEFAULT_CHARACTERISTICS);
    expect(event.giti_version).toBe('0.1.0');
    expect(event.node_version).toBe(process.version);
    expect(event.os_platform).toBe(process.platform);
  });

  it('does NOT record when telemetry is disabled', async () => {
    mockGetUserConfig.mockResolvedValue({ enabled: false, first_prompt_shown: true });

    await recordCommandTelemetry('/repo', 'pulse', [], 100, 0);

    expect(mockAppendEvent).not.toHaveBeenCalled();
    expect(mockBuildRepoCharacteristics).not.toHaveBeenCalled();
  });

  it('silently swallows errors from appendEvent', async () => {
    setupEnabledMocks();
    mockAppendEvent.mockRejectedValue(new Error('disk full'));

    // Must not throw
    await expect(
      recordCommandTelemetry('/repo', 'pulse', [], 100, 0),
    ).resolves.toBeUndefined();
  });

  it('silently swallows errors from getUserConfig', async () => {
    mockGetUserConfig.mockRejectedValue(new Error('corrupt config'));

    await expect(
      recordCommandTelemetry('/repo', 'pulse', [], 100, 0),
    ).resolves.toBeUndefined();
  });

  it('silently swallows errors from buildRepoCharacteristics', async () => {
    mockGetUserConfig.mockResolvedValue({ enabled: true, first_prompt_shown: true });
    mockCreateGitClient.mockReturnValue({} as ReturnType<typeof createGitClient>);
    mockBuildRepoCharacteristics.mockRejectedValue(new Error('git not found'));

    await expect(
      recordCommandTelemetry('/repo', 'pulse', [], 100, 0),
    ).resolves.toBeUndefined();
  });

  it('event has valid UUID and ISO timestamp', async () => {
    setupEnabledMocks();

    await recordCommandTelemetry('/repo', 'hotspots', [], 500, 0);

    const event = mockAppendEvent.mock.calls[0]![1] as TelemetryEvent;

    // UUID v4 format
    expect(event.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // ISO 8601 timestamp
    const parsed = new Date(event.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes error_type when provided', async () => {
    setupEnabledMocks();

    await recordCommandTelemetry('/repo', 'pulse', [], 100, 1, 'GitNotFoundError');

    const event = mockAppendEvent.mock.calls[0]![1] as TelemetryEvent;
    expect(event.error_type).toBe('GitNotFoundError');
  });

  it('falls back to version 0.0.0 when package.json has no version', async () => {
    setupEnabledMocks();
    mockReadJsonFile.mockResolvedValue({});

    await recordCommandTelemetry('/repo', 'pulse', [], 100, 0);

    const event = mockAppendEvent.mock.calls[0]![1] as TelemetryEvent;
    expect(event.giti_version).toBe('0.0.0');
  });

  it('falls back to version 0.0.0 when package.json is missing', async () => {
    setupEnabledMocks();
    mockReadJsonFile.mockResolvedValue(null);

    await recordCommandTelemetry('/repo', 'pulse', [], 100, 0);

    const event = mockAppendEvent.mock.calls[0]![1] as TelemetryEvent;
    expect(event.giti_version).toBe('0.0.0');
  });
});

// ── extractFlags ───────────────────────────────────────────────────

describe('extractFlags', () => {
  it('extracts boolean flags as --flag', () => {
    const flags = extractFlags({ json: true, verbose: true });
    expect(flags).toContain('--json');
    expect(flags).toContain('--verbose');
  });

  it('extracts string flags as --key=value', () => {
    const flags = extractFlags({ period: '30d', format: 'table' });
    expect(flags).toContain('--period=30d');
    expect(flags).toContain('--format=table');
  });

  it('handles a mix of boolean and string flags', () => {
    const flags = extractFlags({ json: true, period: '7d' });
    expect(flags).toContain('--json');
    expect(flags).toContain('--period=7d');
    expect(flags).toHaveLength(2);
  });

  it('ignores undefined values', () => {
    const flags = extractFlags({ json: undefined, period: '7d' });
    expect(flags).toEqual(['--period=7d']);
  });

  it('ignores null values', () => {
    const flags = extractFlags({ json: null as unknown, period: '7d' });
    expect(flags).toEqual(['--period=7d']);
  });

  it('ignores false boolean values', () => {
    const flags = extractFlags({ json: false, verbose: true });
    expect(flags).toEqual(['--verbose']);
  });

  it('returns empty array for empty options', () => {
    const flags = extractFlags({});
    expect(flags).toEqual([]);
  });
});
