import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

// ── mocks ──────────────────────────────────────────────────────────

vi.mock('../../src/telemetry/collector.js', () => ({
  recordCommandTelemetry: vi.fn().mockResolvedValue(undefined),
  extractFlags: vi.fn().mockReturnValue([]),
}));

vi.mock('../../src/agents/utils.js', () => ({
  runCommand: vi.fn().mockReturnValue({ stdout: '', stderr: '', status: 0 }),
  ensureOrganismDir: vi.fn().mockResolvedValue(''),
  getOrganismPath: vi.fn().mockReturnValue(''),
  readJsonFile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/telemetry/store.js', () => ({
  getUserConfig: vi.fn().mockResolvedValue({ enabled: false, first_prompt_shown: false }),
  setUserConfig: vi.fn().mockResolvedValue(undefined),
  appendEvent: vi.fn().mockResolvedValue(undefined),
}));

import { generateRepo } from '../../src/simulator/repo-generator.js';
import { scenarios, selectScenario } from '../../src/simulator/scenarios.js';
import { runSimulation } from '../../src/simulator/index.js';
import { recordCommandTelemetry } from '../../src/telemetry/collector.js';
import { runCommand } from '../../src/agents/utils.js';
import { getUserConfig, setUserConfig } from '../../src/telemetry/store.js';

const mockRecordCommandTelemetry = vi.mocked(recordCommandTelemetry);
const mockRunCommand = vi.mocked(runCommand);
const mockGetUserConfig = vi.mocked(getUserConfig);
const mockSetUserConfig = vi.mocked(setUserConfig);

// ── repo-generator ────────────────────────────────────────────────

describe('generateRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a fresh repo with commits and files', async () => {
    const { repoPath, cleanup } = await generateRepo('fresh');

    try {
      // Verify the temp directory exists
      const stat = await fs.stat(repoPath);
      expect(stat.isDirectory()).toBe(true);

      // Verify files were created
      const files = await fs.readdir(repoPath);
      const tsFiles = files.filter((f) => f.endsWith('.ts'));
      expect(tsFiles.length).toBeGreaterThanOrEqual(3);

      // Verify it's a git repo with commits
      const simpleGit = (await import('simple-git')).default;
      const git = simpleGit(repoPath);
      const log = await git.log();
      expect(log.total).toBe(5); // 3 creates + 2 modifications
    } finally {
      await cleanup();
    }
  });

  it('generates a small repo with more commits than fresh', async () => {
    const { repoPath: freshPath, cleanup: cleanupFresh } = await generateRepo('fresh');
    const { repoPath: smallPath, cleanup: cleanupSmall } = await generateRepo('small');

    try {
      const simpleGit = (await import('simple-git')).default;
      const freshLog = await simpleGit(freshPath).log();
      const smallLog = await simpleGit(smallPath).log();

      expect(smallLog.total).toBeGreaterThan(freshLog.total);
      // Small: 10 creates + 10 modifications = 20
      expect(smallLog.total).toBe(20);
    } finally {
      await cleanupFresh();
      await cleanupSmall();
    }
  });

  it('cleanup function removes the temp directory', async () => {
    const { repoPath, cleanup } = await generateRepo('fresh');

    // Verify it exists
    const stat = await fs.stat(repoPath);
    expect(stat.isDirectory()).toBe(true);

    // Clean up
    await cleanup();

    // Verify it's gone
    await expect(fs.stat(repoPath)).rejects.toThrow();
  });
});

// ── selectScenario ────────────────────────────────────────────────

describe('selectScenario', () => {
  it('returns one of the known scenario names', () => {
    const knownNames = Object.keys(scenarios);

    // Run it multiple times to increase confidence
    for (let i = 0; i < 50; i++) {
      const name = selectScenario();
      expect(knownNames).toContain(name);
    }
  });
});

// ── scenarios ─────────────────────────────────────────────────────

describe('scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunCommand.mockReturnValue({ stdout: '', stderr: '', status: 0 });
    mockRecordCommandTelemetry.mockResolvedValue(undefined);
  });

  it('quickCheck calls pulse command and records telemetry', async () => {
    const result = await scenarios['quickCheck']!('/tmp/test-repo');

    expect(result.commands).toEqual(['pulse']);
    expect(result.events).toBe(1);

    expect(mockRunCommand).toHaveBeenCalledOnce();
    expect(mockRunCommand).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining(['pulse', '--path', '/tmp/test-repo']),
      expect.any(String),
    );

    expect(mockRecordCommandTelemetry).toHaveBeenCalledOnce();
    expect(mockRecordCommandTelemetry).toHaveBeenCalledWith(
      '/tmp/test-repo',
      'pulse',
      [],
      expect.any(Number),
      0,
    );
  });

  it('deepAnalysis runs pulse, hotspots, and ghosts', async () => {
    const result = await scenarios['deepAnalysis']!('/tmp/test-repo');

    expect(result.commands).toEqual(['pulse', 'hotspots', 'ghosts']);
    expect(result.events).toBe(3);
    expect(mockRunCommand).toHaveBeenCalledTimes(3);
    expect(mockRecordCommandTelemetry).toHaveBeenCalledTimes(3);
  });

  it('hotspotFocus runs hotspots with three time periods', async () => {
    const result = await scenarios['hotspotFocus']!('/tmp/test-repo');

    expect(result.commands).toEqual(['hotspots', 'hotspots', 'hotspots']);
    expect(result.events).toBe(3);
    expect(mockRunCommand).toHaveBeenCalledTimes(3);
  });

  it('errorPath records error telemetry', async () => {
    mockRunCommand.mockReturnValue({ stdout: '', stderr: 'not found', status: 1 });

    const result = await scenarios['errorPath']!('/tmp/test-repo');

    expect(result.commands).toEqual(['pulse']);
    expect(result.events).toBe(1);

    expect(mockRecordCommandTelemetry).toHaveBeenCalledWith(
      '/tmp/test-repo',
      'pulse',
      [],
      expect.any(Number),
      1,
      'Error',
    );
  });

  it('cleanupMode runs ghosts command', async () => {
    const result = await scenarios['cleanupMode']!('/tmp/test-repo');

    expect(result.commands).toEqual(['ghosts']);
    expect(result.events).toBe(1);
    expect(mockRunCommand).toHaveBeenCalledOnce();
  });

  it('jsonPipeline runs pulse and hotspots with --json flag', async () => {
    const result = await scenarios['jsonPipeline']!('/tmp/test-repo');

    expect(result.commands).toEqual(['pulse', 'hotspots']);
    expect(result.events).toBe(2);
    expect(mockRecordCommandTelemetry).toHaveBeenCalledTimes(2);

    // Both calls should have --json flag
    for (const call of mockRecordCommandTelemetry.mock.calls) {
      expect(call[2]).toEqual(['--json']);
    }
  });
});

// ── runSimulation ─────────────────────────────────────────────────

describe('runSimulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserConfig.mockResolvedValue({ enabled: false, first_prompt_shown: false });
    mockSetUserConfig.mockResolvedValue(undefined);
    mockRunCommand.mockReturnValue({ stdout: '', stderr: '', status: 0 });
    mockRecordCommandTelemetry.mockResolvedValue(undefined);
  });

  it('produces correct totals in simulation result', async () => {
    const result = await runSimulation('/repo', {
      scenario_count: 2,
      repo_types: ['fresh'],
    });

    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.total_scenarios).toBeGreaterThan(0);
    expect(result.total_events).toBeGreaterThan(0);
    expect(result.results.length).toBe(result.total_scenarios);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);

    // Verify total_events matches sum of results
    const sumEvents = result.results.reduce((sum, r) => sum + r.events_generated, 0);
    expect(result.total_events).toBe(sumEvents);

    // All results should be for 'fresh' repo type
    for (const r of result.results) {
      expect(r.repo_type).toBe('fresh');
    }
  });

  it('enables telemetry during simulation and restores config after', async () => {
    await runSimulation('/repo', {
      scenario_count: 1,
      repo_types: ['fresh'],
    });

    // Should have enabled telemetry
    expect(mockSetUserConfig).toHaveBeenCalledWith({ enabled: true, first_prompt_shown: true });

    // Last call should restore original config
    const lastCall = mockSetUserConfig.mock.calls[mockSetUserConfig.mock.calls.length - 1];
    expect(lastCall![0]).toEqual({ enabled: false, first_prompt_shown: false });
  });

  it('restores telemetry config even when scenarios fail', async () => {
    mockRunCommand.mockImplementation(() => {
      throw new Error('command failed');
    });

    const result = await runSimulation('/repo', {
      scenario_count: 1,
      repo_types: ['fresh'],
    });

    // Should still complete (failures are non-critical)
    expect(result).toBeDefined();

    // Original config should be restored
    const lastCall = mockSetUserConfig.mock.calls[mockSetUserConfig.mock.calls.length - 1];
    expect(lastCall![0]).toEqual({ enabled: false, first_prompt_shown: false });
  });
});
