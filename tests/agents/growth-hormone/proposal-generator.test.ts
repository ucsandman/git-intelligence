import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(function (this: { messages: { create: typeof mockCreate } }) {
      this.messages = { create: mockCreate };
    }),
  };
});

import {
  buildProposalPrompt,
  parseProposalResponse,
  validateProposal,
  generateProposals,
} from '../../../src/agents/growth-hormone/proposal-generator.js';
import type { GrowthSignal, GrowthProposal } from '../../../src/agents/growth-hormone/types.js';
import type { OrganismConfig } from '../../../src/agents/types.js';
import type { KnowledgeBase } from '../../../src/agents/memory/types.js';

// ── fixtures ──────────────────────────────────────────────────────────

function makeSignal(confidence = 0.8): GrowthSignal {
  return {
    type: 'usage-concentration',
    title: 'pulse dominates usage',
    evidence: '60% of runs',
    confidence,
    data: {},
  };
}

function makeProposalJson(overrides: Partial<GrowthProposal> = {}): GrowthProposal {
  return {
    id: '',
    timestamp: '',
    title: 'Add giti health command',
    description: 'Combine pulse and hotspots into one view',
    rationale: 'Users frequently run both commands in sequence',
    evidence: [
      { signal_type: 'usage-sequence', data_point: 'pulse → hotspots 45% of sessions', confidence: 0.8 },
      { signal_type: 'usage-concentration', data_point: 'pulse 60% of runs', confidence: 0.9 },
    ],
    proposed_interface: {
      command: 'giti health',
      flags: ['--json'],
      output_description: 'Combined pulse + hotspots view',
    },
    estimated_complexity: 'medium',
    target_files: ['src/commands/health.ts'],
    dependencies_needed: [],
    alignment: {
      purpose_alignment: 'Improves developer workflow',
      growth_zone_category: 'repository health assessment',
      principle_compliance: ['discoverable without documentation'],
    },
    risks: ['May overlap with existing commands'],
    success_metrics: ['health command usage > 10% of total'],
    status: 'proposed',
    ...overrides,
  };
}

const mockConfig: OrganismConfig = {
  quality_standards: {
    test_coverage_floor: 80,
    max_complexity_per_function: 15,
    max_file_length: 300,
    zero_tolerance: ['any:errors', 'security:vulnerabilities'],
    performance_budget: {
      pulse_command: '< 2 seconds on repos up to 10k commits',
      hotspots_command: '< 5 seconds on repos up to 10k commits',
      any_new_command: '< 10 seconds on repos up to 10k commits',
    },
  },
  boundaries: {
    growth_zone: [
      'git data analysis and visualization',
      'repository health assessment',
      'developer workflow intelligence',
    ],
    forbidden_zone: [
      'modifying the target repository in any way',
      'accessing external APIs or services without explicit user consent',
      'collecting or transmitting user data',
      'replacing existing git commands',
      'requiring authentication or accounts',
      'adding GUI or web interface (stay CLI-native)',
    ],
  },
  lifecycle: {
    cycle_frequency: 'daily',
    max_changes_per_cycle: 3,
    mandatory_cooldown_after_regression: '48 hours',
    branch_naming: 'organism/{cortex}/{description}',
    requires_immune_approval: true,
  },
};

function makeKb(overrides: Partial<KnowledgeBase> = {}): KnowledgeBase {
  return {
    created: '2025-01-01T00:00:00.000Z',
    last_updated: '2025-01-01T00:00:00.000Z',
    cycle_count: 5,
    events: [],
    lessons: [],
    patterns: {
      fragile_files: [],
      rejection_reasons: {},
      successful_change_types: {},
      failed_change_types: {},
    },
    preferences: [],
    ...overrides,
  };
}

// ── buildProposalPrompt ───────────────────────────────────────────────

describe('buildProposalPrompt', () => {
  it('includes signal titles and evidence', () => {
    const signals: GrowthSignal[] = [
      makeSignal(0.8),
      { type: 'error-pattern', title: 'hotspots high error rate', evidence: '12% errors', confidence: 0.7, data: {} },
    ];
    const prompt = buildProposalPrompt(signals, mockConfig);
    expect(prompt).toContain('pulse dominates usage');
    expect(prompt).toContain('60% of runs');
    expect(prompt).toContain('hotspots high error rate');
    expect(prompt).toContain('12% errors');
  });

  it('includes growth zones from config', () => {
    const prompt = buildProposalPrompt([makeSignal()], mockConfig);
    expect(prompt).toContain('git data analysis and visualization');
    expect(prompt).toContain('repository health assessment');
    expect(prompt).toContain('developer workflow intelligence');
  });

  it('includes forbidden zones from config', () => {
    const prompt = buildProposalPrompt([makeSignal()], mockConfig);
    expect(prompt).toContain('modifying the target repository in any way');
    expect(prompt).toContain('replacing existing git commands');
    expect(prompt).toContain('adding GUI or web interface');
  });

  it('requests JSON format response', () => {
    const prompt = buildProposalPrompt([makeSignal()], mockConfig);
    expect(prompt).toContain('```json');
    expect(prompt).toContain('JSON');
  });
});

// ── parseProposalResponse ─────────────────────────────────────────────

describe('parseProposalResponse', () => {
  it('extracts proposals from ```json code block', () => {
    const proposal = makeProposalJson();
    const text = `Here are my proposals:\n\`\`\`json\n${JSON.stringify([proposal])}\n\`\`\``;
    const result = parseProposalResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Add giti health command');
  });

  it('handles plain JSON without code blocks', () => {
    const proposal = makeProposalJson();
    const text = JSON.stringify([proposal]);
    const result = parseProposalResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Add giti health command');
  });

  it('assigns UUID and timestamp to each proposal', () => {
    const proposal = makeProposalJson();
    const text = `\`\`\`json\n${JSON.stringify([proposal])}\n\`\`\``;
    const result = parseProposalResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBeTruthy();
    expect(result[0]!.id).not.toBe('');
    expect(result[0]!.timestamp).toBeTruthy();
    expect(result[0]!.timestamp).not.toBe('');
    // Verify timestamp is ISO format
    expect(() => new Date(result[0]!.timestamp)).not.toThrow();
  });

  it('sets status to proposed', () => {
    const proposal = makeProposalJson({ status: 'approved' });
    const text = `\`\`\`json\n${JSON.stringify([proposal])}\n\`\`\``;
    const result = parseProposalResponse(text);
    expect(result[0]!.status).toBe('proposed');
  });

  it('returns empty array for unparseable response', () => {
    const result = parseProposalResponse('Sorry, I cannot generate proposals.');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const result = parseProposalResponse('');
    expect(result).toEqual([]);
  });
});

// ── validateProposal ──────────────────────────────────────────────────

describe('validateProposal', () => {
  it('valid proposal passes validation', () => {
    const proposal = makeProposalJson({ id: 'test-id', timestamp: new Date().toISOString() });
    const result = validateProposal(proposal, mockConfig, null);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects proposal with forbidden zone keyword in title', () => {
    const proposal = makeProposalJson({
      id: 'test-id',
      timestamp: new Date().toISOString(),
      title: 'Add GUI web interface for repo visualization',
    });
    const result = validateProposal(proposal, mockConfig, null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('forbidden');
  });

  it('rejects proposal with forbidden zone keyword in description', () => {
    const proposal = makeProposalJson({
      id: 'test-id',
      timestamp: new Date().toISOString(),
      description: 'This would involve modifying the target repository to add markers',
    });
    const result = validateProposal(proposal, mockConfig, null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('forbidden');
  });

  it('rejects proposal with < 2 evidence points', () => {
    const proposal = makeProposalJson({
      id: 'test-id',
      timestamp: new Date().toISOString(),
      evidence: [{ signal_type: 'usage-concentration', data_point: 'pulse 60%', confidence: 0.9 }],
    });
    const result = validateProposal(proposal, mockConfig, null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('evidence');
  });

  it('rejects proposal similar to previously rejected growth (in KB)', () => {
    const proposal = makeProposalJson({
      id: 'test-id',
      timestamp: new Date().toISOString(),
      title: 'Add giti health command with dashboard',
    });
    const kb = makeKb({
      events: [
        {
          id: 'evt-1',
          timestamp: '2025-01-01T00:00:00.000Z',
          cycle: 3,
          type: 'growth-rejected',
          agent: 'immune-system',
          summary: 'Rejected health command proposal',
          data: { title: 'Add giti health command' },
          tags: [],
        },
      ],
    });
    const result = validateProposal(proposal, mockConfig, kb);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('similar');
  });

  it('rejects proposal needing > 2 dependencies', () => {
    const proposal = makeProposalJson({
      id: 'test-id',
      timestamp: new Date().toISOString(),
      dependencies_needed: ['dep-a', 'dep-b', 'dep-c'],
    });
    const result = validateProposal(proposal, mockConfig, null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('dependencies');
  });

  it('passes proposal with exactly 2 deps', () => {
    const proposal = makeProposalJson({
      id: 'test-id',
      timestamp: new Date().toISOString(),
      dependencies_needed: ['dep-a', 'dep-b'],
    });
    const result = validateProposal(proposal, mockConfig, null);
    expect(result.valid).toBe(true);
  });

  it('passes when KB is null (no redundancy check)', () => {
    const proposal = makeProposalJson({
      id: 'test-id',
      timestamp: new Date().toISOString(),
    });
    const result = validateProposal(proposal, mockConfig, null);
    expect(result.valid).toBe(true);
  });
});

// ── generateProposals ─────────────────────────────────────────────────

describe('generateProposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty when fewer than 2 strong signals', async () => {
    const signals = [makeSignal(0.8), makeSignal(0.4)]; // only 1 strong
    const result = await generateProposals(signals, mockConfig, null);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('calls Claude API and returns valid proposals', async () => {
    const proposal = makeProposalJson();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify([proposal])}\n\`\`\`` }],
    });

    const signals = [makeSignal(0.8), makeSignal(0.7)];
    const result = await generateProposals(signals, mockConfig, null);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Add giti health command');
    expect(result[0]!.status).toBe('proposed');
    expect(result[0]!.id).toBeTruthy();
  });

  it('filters out invalid proposals', async () => {
    const validProposal = makeProposalJson();
    const invalidProposal = makeProposalJson({
      title: 'Add GUI web interface',
      description: 'Build a web interface for the tool',
    });
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: `\`\`\`json\n${JSON.stringify([validProposal, invalidProposal])}\n\`\`\``,
      }],
    });

    const signals = [makeSignal(0.8), makeSignal(0.7)];
    const result = await generateProposals(signals, mockConfig, null);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Add giti health command');
  });

  it('returns max 2 proposals even if API returns more', async () => {
    const proposals = [
      makeProposalJson({ title: 'Feature A' }),
      makeProposalJson({ title: 'Feature B' }),
      makeProposalJson({ title: 'Feature C' }),
    ];
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(proposals)}\n\`\`\`` }],
    });

    const signals = [makeSignal(0.8), makeSignal(0.7)];
    const result = await generateProposals(signals, mockConfig, null);

    expect(result.length).toBeLessThanOrEqual(2);
  });
});
