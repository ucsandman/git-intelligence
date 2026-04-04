import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GrowthProposal } from '../../../src/agents/growth-hormone/types.js';

// ── mocks ─────────────────────────────────────────────────────────

vi.mock('../../../src/telemetry/store.js', () => ({
  readEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/telemetry/reporter.js', () => ({
  aggregateTelemetry: vi.fn().mockReturnValue({
    total_events: 0,
    period_days: 0,
    command_frequency: {},
    flag_frequency: {},
    error_rate_by_command: {},
    avg_execution_ms_by_command: {},
    repo_size_distribution: {},
    usage_sequences: [],
    json_usage_percent: 0,
  }),
}));

vi.mock('../../../src/agents/utils.js', () => ({
  loadOrganismConfig: vi.fn().mockResolvedValue({
    quality_standards: {
      test_coverage_floor: 80,
      max_complexity_per_function: 15,
      max_file_length: 300,
      zero_tolerance: [],
      performance_budget: {},
    },
    boundaries: {
      growth_zone: ['new-analysis-commands'],
      forbidden_zone: ['git-write-operations'],
    },
    lifecycle: {
      cycle_frequency: 'daily',
      max_changes_per_cycle: 3,
      mandatory_cooldown_after_regression: '48 hours',
      branch_naming: 'organism/{cortex}/{description}',
      requires_immune_approval: true,
    },
  }),
  readJsonFile: vi.fn().mockResolvedValue(null),
  writeJsonFile: vi.fn().mockResolvedValue(undefined),
  ensureOrganismDir: vi.fn().mockResolvedValue(''),
  getOrganismPath: vi.fn().mockImplementation((...args: string[]) => args.join('/')),
}));

vi.mock('../../../src/agents/memory/store.js', () => ({
  loadKnowledgeBase: vi.fn().mockResolvedValue({
    lessons: [],
    patterns: { fragile_files: [], coupling_groups: [] },
    preferences: [],
  }),
}));

vi.mock('../../../src/agents/memory/index.js', () => ({
  recordMemoryEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/agents/growth-hormone/signal-analyzer.js', () => ({
  analyzeSignals: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../src/agents/growth-hormone/proposal-generator.js', () => ({
  generateProposals: vi.fn().mockResolvedValue([]),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
  },
}));

import { readEvents } from '../../../src/telemetry/store.js';
import { aggregateTelemetry } from '../../../src/telemetry/reporter.js';
import { analyzeSignals } from '../../../src/agents/growth-hormone/signal-analyzer.js';
import { generateProposals } from '../../../src/agents/growth-hormone/proposal-generator.js';
import { readJsonFile, writeJsonFile, ensureOrganismDir } from '../../../src/agents/utils.js';
import { recordMemoryEvent } from '../../../src/agents/memory/index.js';
import { runGrowthHormone, loadApprovedProposals, loadAllProposals, reviewProposal } from '../../../src/agents/growth-hormone/index.js';
import fs from 'node:fs/promises';

const mockReadEvents = vi.mocked(readEvents);
const mockAggregateTelemetry = vi.mocked(aggregateTelemetry);
const mockAnalyzeSignals = vi.mocked(analyzeSignals);
const mockGenerateProposals = vi.mocked(generateProposals);
const mockReadJsonFile = vi.mocked(readJsonFile);
const mockWriteJsonFile = vi.mocked(writeJsonFile);
const mockRecordMemoryEvent = vi.mocked(recordMemoryEvent);

const sampleProposal: GrowthProposal = {
  id: 'growth-001',
  timestamp: '2026-04-01T00:00:00.000Z',
  title: 'Add timeline command',
  description: 'A timeline view',
  rationale: 'Users need it',
  evidence: [{ signal_type: 'usage-concentration', data_point: '60% pulse', confidence: 0.85 }],
  proposed_interface: { command: 'giti timeline', flags: [], output_description: 'Timeline output' },
  estimated_complexity: 'medium',
  target_files: ['src/commands/timeline.ts'],
  dependencies_needed: [],
  alignment: {
    purpose_alignment: 'Extends analysis',
    growth_zone_category: 'new-analysis-commands',
    principle_compliance: [],
  },
  risks: [],
  success_metrics: [],
  status: 'proposed',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── runGrowthHormone ──────────────────────────────────────────────

describe('runGrowthHormone', () => {
  it('returns empty when no telemetry events', async () => {
    mockReadEvents.mockResolvedValue([]);
    const result = await runGrowthHormone('/repo');
    expect(result).toEqual({ signals: [], proposals: [] });
    expect(mockAggregateTelemetry).not.toHaveBeenCalled();
  });

  it('processes events through the pipeline when events exist', async () => {
    const fakeEvent = { id: 'e1', command: 'pulse', timestamp: 'now' };
    mockReadEvents.mockResolvedValue([fakeEvent as never]);
    mockAnalyzeSignals.mockReturnValue([]);
    mockGenerateProposals.mockResolvedValue([]);

    const result = await runGrowthHormone('/repo');
    expect(mockAggregateTelemetry).toHaveBeenCalledWith([fakeEvent]);
    expect(mockAnalyzeSignals).toHaveBeenCalled();
    expect(result).toEqual({ signals: [], proposals: [] });
  });

  it('saves proposals and records memory events when proposals are generated', async () => {
    mockReadEvents.mockResolvedValue([{ id: 'e1' } as never]);
    mockAnalyzeSignals.mockReturnValue([]);
    mockGenerateProposals.mockResolvedValue([sampleProposal]);

    const result = await runGrowthHormone('/repo');
    expect(result.proposals).toHaveLength(1);
    expect(mockWriteJsonFile).toHaveBeenCalled();
    expect(mockRecordMemoryEvent).toHaveBeenCalledWith(
      '/repo',
      'growth-proposed',
      expect.stringContaining('Add timeline command'),
      expect.any(Object),
    );
  });

  it('handles proposal generation failure gracefully', async () => {
    mockReadEvents.mockResolvedValue([{ id: 'e1' } as never]);
    mockAnalyzeSignals.mockReturnValue([]);
    mockGenerateProposals.mockRejectedValue(new Error('API error'));

    const result = await runGrowthHormone('/repo');
    expect(result.proposals).toEqual([]);
  });
});

// ── loadApprovedProposals ─────────────────────────────────────────

describe('loadApprovedProposals', () => {
  it('returns empty array when directory does not exist', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
    const result = await loadApprovedProposals('/repo');
    expect(result).toEqual([]);
  });

  it('returns only approved proposals', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['a.json', 'b.json', 'c.txt'] as never);
    mockReadJsonFile
      .mockResolvedValueOnce({ ...sampleProposal, status: 'approved' })
      .mockResolvedValueOnce({ ...sampleProposal, status: 'rejected' });

    const result = await loadApprovedProposals('/repo');
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('approved');
  });

  it('skips null entries', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['a.json'] as never);
    mockReadJsonFile.mockResolvedValueOnce(null);

    const result = await loadApprovedProposals('/repo');
    expect(result).toEqual([]);
  });
});

// ── loadAllProposals ──────────────────────────────────────────────

describe('loadAllProposals', () => {
  it('returns empty array when directory does not exist', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
    const result = await loadAllProposals('/repo');
    expect(result).toEqual([]);
  });

  it('returns all proposals with ids', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['a.json', 'b.json'] as never);
    mockReadJsonFile
      .mockResolvedValueOnce({ ...sampleProposal, id: 'a' })
      .mockResolvedValueOnce({ ...sampleProposal, id: 'b' });

    const result = await loadAllProposals('/repo');
    expect(result).toHaveLength(2);
  });

  it('skips non-json files', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['readme.md', 'a.json'] as never);
    mockReadJsonFile.mockResolvedValueOnce({ ...sampleProposal, id: 'a' });

    const result = await loadAllProposals('/repo');
    expect(result).toHaveLength(1);
  });
});

// ── reviewProposal ────────────────────────────────────────────────

describe('reviewProposal', () => {
  it('approves a proposal', async () => {
    mockReadJsonFile.mockResolvedValueOnce({ ...sampleProposal });

    await reviewProposal('/repo', 'growth-001', true, 'Looks good');
    expect(mockWriteJsonFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'approved', immune_system_notes: 'Looks good' }),
    );
    expect(mockRecordMemoryEvent).toHaveBeenCalledWith(
      '/repo',
      'growth-approved',
      expect.stringContaining('approved'),
      expect.any(Object),
    );
  });

  it('rejects a proposal', async () => {
    mockReadJsonFile.mockResolvedValueOnce({ ...sampleProposal });

    await reviewProposal('/repo', 'growth-001', false, 'Too risky');
    expect(mockWriteJsonFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'rejected', immune_system_notes: 'Too risky' }),
    );
    expect(mockRecordMemoryEvent).toHaveBeenCalledWith(
      '/repo',
      'growth-rejected',
      expect.stringContaining('rejected'),
      expect.any(Object),
    );
  });

  it('throws when proposal not found', async () => {
    mockReadJsonFile.mockResolvedValueOnce(null);
    await expect(reviewProposal('/repo', 'nonexistent', true)).rejects.toThrow('Proposal not found');
  });

  it('approves without notes', async () => {
    mockReadJsonFile.mockResolvedValueOnce({ ...sampleProposal });
    await reviewProposal('/repo', 'growth-001', true);
    expect(mockWriteJsonFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'approved' }),
    );
  });
});
