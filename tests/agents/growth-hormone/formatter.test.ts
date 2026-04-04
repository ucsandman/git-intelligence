import { describe, it, expect } from 'vitest';
import { formatGrowthReport, formatProposalDetail } from '../../../src/agents/growth-hormone/formatter.js';
import type { GrowthSignal, GrowthProposal } from '../../../src/agents/growth-hormone/types.js';

// ── fixtures ──────────────────────────────────────────────────────────

function makeSignal(overrides: Partial<GrowthSignal> = {}): GrowthSignal {
  return {
    type: 'usage-concentration',
    title: 'pulse dominates usage',
    evidence: '60% of runs',
    confidence: 0.8,
    data: {},
    ...overrides,
  };
}

function makeProposal(overrides: Partial<GrowthProposal> = {}): GrowthProposal {
  return {
    id: 'growth-001',
    timestamp: '2026-04-01T00:00:00.000Z',
    title: 'Add timeline command',
    description: 'A timeline view for commit history',
    rationale: 'Users need visual timeline',
    evidence: [
      { signal_type: 'usage-concentration', data_point: '60% pulse usage', confidence: 0.85 },
    ],
    proposed_interface: {
      command: 'giti timeline',
      flags: ['--since', '--format'],
      output_description: 'Shows commit timeline',
    },
    estimated_complexity: 'medium',
    target_files: ['src/commands/timeline.ts'],
    dependencies_needed: [],
    alignment: {
      purpose_alignment: 'Extends analysis capabilities',
      growth_zone_category: 'new-analysis-commands',
      principle_compliance: ['read-only', 'non-destructive'],
    },
    risks: ['Performance on large repos'],
    success_metrics: ['Used by 30% of users within 2 weeks'],
    status: 'proposed',
    ...overrides,
  };
}

// ── formatGrowthReport ────────────────────────────────────────────

describe('formatGrowthReport', () => {
  it('shows stable message when no signals or proposals', () => {
    const result = formatGrowthReport([], []);
    expect(result).toContain('No growth signals detected');
    expect(result).toContain('No proposals generated');
  });

  it('shows signals when present', () => {
    const signals = [
      makeSignal({ title: 'Signal A', confidence: 0.9 }),
      makeSignal({ title: 'Signal B', confidence: 0.4 }),
    ];
    const result = formatGrowthReport(signals, []);
    expect(result).toContain('Telemetry signals detected: 2');
    expect(result).toContain('Signal A');
    expect(result).toContain('Signal B');
    expect(result).toContain('No proposals generated');
  });

  it('shows proposals when present', () => {
    const proposals = [makeProposal()];
    const result = formatGrowthReport([], proposals);
    expect(result).toContain('New proposals generated: 1');
    expect(result).toContain('Add timeline command');
    expect(result).toContain('giti timeline');
  });

  it('shows both signals and proposals', () => {
    const signals = [makeSignal()];
    const proposals = [makeProposal()];
    const result = formatGrowthReport(signals, proposals);
    expect(result).toContain('Telemetry signals detected: 1');
    expect(result).toContain('New proposals generated: 1');
    expect(result).toContain('Immune System');
  });

  it('renders confidence colors for different levels', () => {
    const signals = [
      makeSignal({ title: 'High', confidence: 0.9 }),
      makeSignal({ title: 'Mid', confidence: 0.5 }),
      makeSignal({ title: 'Low', confidence: 0.3 }),
    ];
    const result = formatGrowthReport(signals, []);
    // All signal titles should appear
    expect(result).toContain('High');
    expect(result).toContain('Mid');
    expect(result).toContain('Low');
    expect(result).toContain('90%');
    expect(result).toContain('50%');
    expect(result).toContain('30%');
  });
});

// ── formatProposalDetail ──────────────────────────────────────────

describe('formatProposalDetail', () => {
  it('formats a full proposal with all fields', () => {
    const proposal = makeProposal({
      immune_system_notes: 'Approved with minor concerns',
    });
    const result = formatProposalDetail(proposal);
    expect(result).toContain('growth-001');
    expect(result).toContain('Add timeline command');
    expect(result).toContain('proposed');
    expect(result).toContain('medium');
    expect(result).toContain('A timeline view');
    expect(result).toContain('visual timeline');
    expect(result).toContain('giti timeline');
    expect(result).toContain('--since');
    expect(result).toContain('--format');
    expect(result).toContain('Shows commit timeline');
    expect(result).toContain('60% pulse usage');
    expect(result).toContain('new-analysis-commands');
    expect(result).toContain('read-only');
    expect(result).toContain('src/commands/timeline.ts');
    expect(result).toContain('Performance on large repos');
    expect(result).toContain('Used by 30%');
    expect(result).toContain('Approved with minor concerns');
  });

  it('handles proposal with no flags', () => {
    const proposal = makeProposal({
      proposed_interface: {
        command: 'giti simple',
        flags: [],
        output_description: 'Simple output',
      },
    });
    const result = formatProposalDetail(proposal);
    expect(result).toContain('giti simple');
    expect(result).not.toContain('Flags:');
  });

  it('handles proposal with no dependencies', () => {
    const proposal = makeProposal({ dependencies_needed: [] });
    const result = formatProposalDetail(proposal);
    expect(result).not.toContain('Dependencies Needed');
  });

  it('shows dependencies when present', () => {
    const proposal = makeProposal({ dependencies_needed: ['chalk', 'ora'] });
    const result = formatProposalDetail(proposal);
    expect(result).toContain('Dependencies Needed');
    expect(result).toContain('chalk');
    expect(result).toContain('ora');
  });

  it('handles proposal with no risks', () => {
    const proposal = makeProposal({ risks: [] });
    const result = formatProposalDetail(proposal);
    expect(result).not.toContain('Risks');
  });

  it('handles proposal with no success_metrics', () => {
    const proposal = makeProposal({ success_metrics: [] });
    const result = formatProposalDetail(proposal);
    expect(result).not.toContain('Success Metrics');
  });

  it('handles proposal with no target_files', () => {
    const proposal = makeProposal({ target_files: [] });
    const result = formatProposalDetail(proposal);
    expect(result).not.toContain('Target Files');
  });

  it('handles proposal without immune_system_notes', () => {
    const proposal = makeProposal({ immune_system_notes: undefined });
    const result = formatProposalDetail(proposal);
    expect(result).not.toContain('Immune System Notes');
  });

  it('formats all status values', () => {
    for (const status of ['proposed', 'approved', 'rejected', 'implemented'] as const) {
      const proposal = makeProposal({ status });
      const result = formatProposalDetail(proposal);
      expect(result).toContain(status);
    }
  });

  it('formats all complexity values', () => {
    for (const complexity of ['small', 'medium', 'large'] as const) {
      const proposal = makeProposal({ estimated_complexity: complexity });
      const result = formatProposalDetail(proposal);
      expect(result).toContain(complexity);
    }
  });

  it('handles proposal with no principle_compliance', () => {
    const proposal = makeProposal({
      alignment: {
        purpose_alignment: 'Aligns',
        growth_zone_category: 'zone',
        principle_compliance: [],
      },
    });
    const result = formatProposalDetail(proposal);
    expect(result).not.toContain('Principles:');
  });
});
