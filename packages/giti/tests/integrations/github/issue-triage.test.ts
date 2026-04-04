import { describe, it, expect } from 'vitest';
import { triageIssues, formatTriageComment } from '../../../src/integrations/github/issue-triage.js';
import { calculateNextVersion, formatReleaseNotes } from '../../../src/integrations/github/release-notes.js';
import type { OrganismConfig } from '../../../src/agents/types.js';
import type { GrowthProposal } from '../../../src/agents/growth-hormone/types.js';
import type { ImplementationResult } from '../../../src/agents/motor-cortex/types.js';
import type { CycleResult } from '../../../src/agents/orchestrator/types.js';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<OrganismConfig> = {}): OrganismConfig {
  return {
    quality_standards: overrides.quality_standards ?? {
      test_coverage_floor: 80,
      max_complexity_per_function: 15,
      max_file_length: 300,
      zero_tolerance: ['any:errors', 'security:vulnerabilities'],
      performance_budget: {
        pulse_command: '< 2 seconds on repos up to 10k commits',
        hotspots_command: '< 5 seconds on repos up to 10k commits',
      },
    },
    boundaries: overrides.boundaries ?? {
      growth_zone: [
        'git data analysis and visualization',
        'repository health assessment',
        'developer workflow intelligence',
        'codebase archaeology and forensics',
        'commit pattern recognition',
        'team dynamics and contributor analytics',
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
    lifecycle: overrides.lifecycle ?? {
      cycle_frequency: 'daily',
      max_changes_per_cycle: 3,
      mandatory_cooldown_after_regression: '48 hours',
      branch_naming: 'organism/{cortex}/{description}',
      requires_immune_approval: true,
    },
  };
}

function makeProposal(overrides: Partial<GrowthProposal> = {}): GrowthProposal {
  return {
    id: overrides.id ?? 'gp-1',
    timestamp: overrides.timestamp ?? '2026-04-04T00:00:00Z',
    title: overrides.title ?? 'Add commit frequency heatmap',
    description: overrides.description ?? 'Visualize commit frequency across days and hours.',
    rationale: overrides.rationale ?? 'Users frequently run pulse to see activity; a heatmap adds depth.',
    evidence: overrides.evidence ?? [
      { signal_type: 'usage-concentration', data_point: 'pulse invoked 200 times/week', confidence: 0.9 },
      { signal_type: 'missing-capability', data_point: 'no temporal view of commits', confidence: 0.85 },
    ],
    proposed_interface: overrides.proposed_interface ?? {
      command: 'giti heatmap',
      flags: ['--period', '--author'],
      output_description: 'ASCII heatmap of commit frequency',
    },
    estimated_complexity: overrides.estimated_complexity ?? 'medium',
    target_files: overrides.target_files ?? ['src/commands/heatmap.ts'],
    dependencies_needed: overrides.dependencies_needed ?? [],
    alignment: overrides.alignment ?? {
      purpose_alignment: 'Surfaces temporal patterns humans miss',
      growth_zone_category: 'git data analysis and visualization',
      principle_compliance: ['discoverable', 'fast'],
    },
    risks: overrides.risks ?? ['Might be slow on very large repos'],
    success_metrics: overrides.success_metrics ?? ['Used by 10% of users within 2 weeks'],
    status: overrides.status ?? 'implemented',
  };
}

function makeImplementation(overrides: Partial<ImplementationResult> = {}): ImplementationResult {
  return {
    work_item_id: overrides.work_item_id ?? 'wi-1',
    branch_name: overrides.branch_name ?? 'organism/growth/heatmap',
    status: overrides.status ?? 'success',
    files_modified: overrides.files_modified ?? ['src/index.ts'],
    files_created: overrides.files_created ?? ['src/commands/heatmap.ts', 'tests/commands/heatmap.test.ts'],
    files_deleted: overrides.files_deleted ?? [],
    lines_added: overrides.lines_added ?? 180,
    lines_removed: overrides.lines_removed ?? 5,
    tests_added: overrides.tests_added ?? 8,
    tests_modified: overrides.tests_modified ?? 0,
    pre_review_check: overrides.pre_review_check ?? {
      tests_pass: true,
      lint_clean: true,
      builds: true,
    },
    claude_tokens_used: overrides.claude_tokens_used ?? 5000,
  };
}

function makeCycleResult(overrides: Partial<CycleResult> = {}): CycleResult {
  return {
    cycle: overrides.cycle ?? 1,
    outcome: overrides.outcome ?? 'productive',
    changes_merged: overrides.changes_merged ?? 2,
    changes_attempted: overrides.changes_attempted ?? 3,
    changes_approved: overrides.changes_approved ?? 2,
    changes_rejected: overrides.changes_rejected ?? 1,
    duration_ms: overrides.duration_ms ?? 30000,
    api_tokens_used: overrides.api_tokens_used ?? 10000,
    regressions: overrides.regressions ?? [],
  };
}

// ── triageIssues ────────────────────────────────────────────────────────

describe('triageIssues', () => {
  const config = makeConfig();

  it('marks issue matching growth zone keywords as addressable', () => {
    const issues = [{
      number: 1,
      title: 'Add better data analysis for git repos',
      body: 'It would be great to have visualization of commit patterns.',
      labels: ['enhancement'],
    }];

    const results = triageIssues(issues, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.addressable).toBe(true);
    expect(results[0]!.reason).toContain('growth zone');
  });

  it('marks issue matching forbidden zone as not addressable even if it also matches growth zone', () => {
    const issues = [{
      number: 2,
      title: 'Feature: collecting and transmitting user data for analytics',
      body: 'We should add collecting telemetry and transmitting user data to improve analysis.',
      labels: ['feature'],
    }];

    const results = triageIssues(issues, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.addressable).toBe(false);
    expect(results[0]!.reason).toContain('forbidden zone');
  });

  it('marks issue matching giti command keywords as addressable', () => {
    const issues = [{
      number: 3,
      title: 'Improve pulse command performance',
      body: 'The hotspots analysis is slow on large repos.',
      labels: ['bug'],
    }];

    const results = triageIssues(issues, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.addressable).toBe(true);
    expect(results[0]!.reason).toBe('Matches giti capabilities');
  });

  it('marks generic issue with no matching keywords as not addressable', () => {
    const issues = [{
      number: 4,
      title: 'Update the license file',
      body: 'We should switch to MIT license.',
      labels: ['docs'],
    }];

    const results = triageIssues(issues, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.addressable).toBe(false);
    expect(results[0]!.reason).toBe('Does not match organism capabilities');
  });

  it('triages multiple issues correctly in batch', () => {
    const issues = [
      {
        number: 10,
        title: 'Add commit pattern recognition feature',
        body: 'Analyze commit patterns across the team.',
        labels: ['enhancement'],
      },
      {
        number: 11,
        title: 'Fix typo in README',
        body: 'There is a typo on line 5.',
        labels: ['docs'],
      },
      {
        number: 12,
        title: 'Pulse command crashes on empty repo',
        body: 'Running giti pulse on a fresh repo with no commits fails.',
        labels: ['bug'],
      },
    ];

    const results = triageIssues(issues, config);
    expect(results).toHaveLength(3);
    expect(results[0]!.number).toBe(10);
    expect(results[0]!.addressable).toBe(true);
    expect(results[1]!.number).toBe(11);
    expect(results[1]!.addressable).toBe(false);
    expect(results[2]!.number).toBe(12);
    expect(results[2]!.addressable).toBe(true);
  });
});

// ── formatTriageComment ─────────────────────────────────────────────────

describe('formatTriageComment', () => {
  it('returns expected comment string', () => {
    const comment = formatTriageComment('Some issue title');
    expect(comment).toContain('future growth cycle');
    expect(comment).toContain('Living Codebase organism');
    expect(comment).toContain('---');
  });
});

// ── calculateNextVersion ────────────────────────────────────────────────

describe('calculateNextVersion', () => {
  it('bumps minor for growth feature: 0.1.0 → 0.2.0', () => {
    expect(calculateNextVersion('0.1.0', true)).toBe('0.2.0');
  });

  it('bumps patch for maintenance: 0.1.0 → 0.1.1', () => {
    expect(calculateNextVersion('0.1.0', false)).toBe('0.1.1');
  });

  it('handles 1.5.3 → 1.6.0 for growth', () => {
    expect(calculateNextVersion('1.5.3', true)).toBe('1.6.0');
  });
});

// ── formatReleaseNotes ──────────────────────────────────────────────────

describe('formatReleaseNotes', () => {
  const proposal = makeProposal();
  const implementation = makeImplementation();
  const history: CycleResult[] = [
    makeCycleResult({ cycle: 1, outcome: 'productive', changes_merged: 2 }),
    makeCycleResult({ cycle: 2, outcome: 'stable', changes_merged: 0 }),
    makeCycleResult({ cycle: 3, outcome: 'productive', changes_merged: 1 }),
  ];

  it('includes proposal title and description', () => {
    const notes = formatReleaseNotes({
      proposal,
      implementation,
      history,
      currentVersion: '0.1.0',
    });

    expect(notes).toContain('Add commit frequency heatmap');
    expect(notes).toContain('Visualize commit frequency across days and hours.');
  });

  it('includes evidence list', () => {
    const notes = formatReleaseNotes({
      proposal,
      implementation,
      history,
      currentVersion: '0.1.0',
    });

    expect(notes).toContain('usage-concentration');
    expect(notes).toContain('pulse invoked 200 times/week');
    expect(notes).toContain('confidence: 0.9');
    expect(notes).toContain('missing-capability');
  });

  it('includes implementation stats', () => {
    const notes = formatReleaseNotes({
      proposal,
      implementation,
      history,
      currentVersion: '0.1.0',
    });

    expect(notes).toContain('organism/growth/heatmap');
    expect(notes).toContain('Files modified: 1');
    expect(notes).toContain('Files created: 2');
    expect(notes).toContain('Lines added: +180');
    expect(notes).toContain('Lines removed: -5');
  });

  it('includes organism stats from history', () => {
    const notes = formatReleaseNotes({
      proposal,
      implementation,
      history,
      currentVersion: '0.1.0',
    });

    expect(notes).toContain('Total autonomous cycles: 3');
    expect(notes).toContain('Total changes merged: 3');
    expect(notes).toContain('Growth features shipped: 2');
  });
});
