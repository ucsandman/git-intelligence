import { describe, it, expect, vi, beforeEach } from 'vitest';
import { narrate, deriveMood } from '../../../src/agents/field-observer/narrator.js';
import type { FieldObservation } from '../../../src/agents/field-observer/types.js';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(function (this: {
      messages: { create: typeof mockCreate };
    }) {
      this.messages = { create: mockCreate };
    }),
  };
});

function fakeRaw(
  overrides: Partial<Omit<FieldObservation, 'narrative' | 'mood' | 'observedAt' | 'cycle'>> = {},
) {
  return {
    target: 'sample',
    targetPath: '/tmp/sample',
    pulse: {
      repoName: 'sample',
      lastCommit: { date: new Date(), message: 'init', author: 'A' },
      weeklyCommits: { count: 3, authorCount: 1 },
      branches: { active: 1, stale: 0 },
      hottestFile: null,
      testRatio: { testFiles: 1, sourceFiles: 2, percentage: 50 },
      avgCommitSize: 10,
      busFactor: { count: 1, topAuthorsPercentage: 100, topAuthorCount: 1 },
    },
    hotspots: { period: '30d', hotspots: [], couplings: [] },
    ghosts: { staleBranches: [], deadCode: [] },
    partial: false,
    errors: [],
    ...overrides,
  };
}

describe('deriveMood', () => {
  it('returns curious on a first-ever observation (no previous)', () => {
    const raw = fakeRaw();
    expect(deriveMood(raw, null)).toBe('curious');
  });

  it('returns curious when new commits appeared since previous', () => {
    const prev: FieldObservation = {
      ...fakeRaw(),
      pulse: { ...fakeRaw().pulse, weeklyCommits: { count: 3, authorCount: 1 } },
      observedAt: '2026-04-10T09:00:00.000Z',
      cycle: 41,
      narrative: '',
      mood: 'attentive',
    };
    const raw = fakeRaw({
      pulse: { ...fakeRaw().pulse, weeklyCommits: { count: 5, authorCount: 1 } },
    });
    expect(deriveMood(raw, prev)).toBe('curious');
  });

  it('returns attentive when nothing changed', () => {
    const prev: FieldObservation = {
      ...fakeRaw(),
      observedAt: '2026-04-10T09:00:00.000Z',
      cycle: 41,
      narrative: '',
      mood: 'attentive',
    };
    const raw = fakeRaw();
    expect(deriveMood(raw, prev)).toBe('attentive');
  });

  it('returns alarmed when test ratio drops sharply', () => {
    const prev: FieldObservation = {
      ...fakeRaw(),
      pulse: {
        ...fakeRaw().pulse,
        testRatio: { testFiles: 10, sourceFiles: 10, percentage: 100 },
      },
      observedAt: '2026-04-10T09:00:00.000Z',
      cycle: 41,
      narrative: '',
      mood: 'attentive',
    };
    const raw = fakeRaw({
      pulse: {
        ...fakeRaw().pulse,
        testRatio: { testFiles: 1, sourceFiles: 10, percentage: 10 },
      },
    });
    expect(deriveMood(raw, prev)).toBe('alarmed');
  });
});

describe('narrate', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('calls Anthropic API and returns narrative text', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'All quiet on the sample front.' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    const raw = fakeRaw();
    const config = {
      enabled: true,
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      cache_system_prompt: true,
    };
    const result = await narrate(raw, null, config);

    expect(result.narrative).toBe('All quiet on the sample front.');
    expect(result.fallback).toBe(false);
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.model).toBe('claude-haiku-4-5-20251001');
    expect(callArg.max_tokens).toBe(600);
    // Prompt caching is set on the system block
    expect(Array.isArray(callArg.system)).toBe(true);
    expect(callArg.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('returns deterministic fallback when API errors', async () => {
    mockCreate.mockRejectedValue(new Error('network down'));

    const raw = fakeRaw();
    const config = {
      enabled: true,
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      cache_system_prompt: true,
    };
    const result = await narrate(raw, null, config);

    expect(result.fallback).toBe(true);
    expect(result.narrative).toContain('sample');
    expect(result.narrative.length).toBeGreaterThan(0);
  });

  it('returns deterministic fallback when narrator is disabled', async () => {
    const raw = fakeRaw();
    const config = {
      enabled: false,
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      cache_system_prompt: true,
    };
    const result = await narrate(raw, null, config);

    expect(result.fallback).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
