import { describe, it, expect } from 'vitest';
import { formatPRBody, formatPRTitle, getPRLabels } from '../../../src/integrations/github/pr-formatter.js';
import type { WorkItem } from '../../../src/agents/prefrontal-cortex/types.js';
import type { ReviewVerdict, CheckResult } from '../../../src/agents/immune-system/types.js';
import type { StateReport } from '../../../src/agents/sensory-cortex/types.js';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: overrides.id ?? 'wi-1',
    tier: overrides.tier ?? 2,
    priority_score: overrides.priority_score ?? 80,
    title: overrides.title ?? 'Fix lint errors',
    description: overrides.description ?? 'Fix all remaining lint errors in src/',
    rationale: overrides.rationale ?? 'Clean codebase improves maintainability',
    target_files: overrides.target_files ?? ['src/index.ts'],
    estimated_complexity: overrides.estimated_complexity ?? 'small',
    memory_context: overrides.memory_context ?? [],
    success_criteria: overrides.success_criteria ?? ['No lint errors'],
    created_by: overrides.created_by ?? 'prefrontal-cortex',
    status: overrides.status ?? 'completed',
  };
}

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    name: overrides.name ?? 'tests',
    status: overrides.status ?? 'pass',
    message: overrides.message ?? 'All tests passing',
    details: overrides.details,
  };
}

function makeVerdict(overrides: Partial<ReviewVerdict> = {}): ReviewVerdict {
  return {
    branch: overrides.branch ?? 'feature/fix-lint',
    timestamp: overrides.timestamp ?? '2026-04-04T00:00:00Z',
    verdict: overrides.verdict ?? 'approve',
    confidence: overrides.confidence ?? 0.95,
    summary: overrides.summary ?? 'All checks pass',
    checks: overrides.checks ?? [
      makeCheck({ name: 'tests', status: 'pass', message: 'All 611 tests passing' }),
      makeCheck({ name: 'lint', status: 'pass', message: 'No lint errors' }),
      makeCheck({ name: 'coverage', status: 'warn', message: 'Coverage at 82%' }),
    ],
    risks: overrides.risks ?? [],
    recommendation: overrides.recommendation ?? 'Safe to merge',
  };
}

function makeStateReport(overrides: {
  test_coverage_percent?: number;
  lint_error_count?: number;
  pulse_execution_ms?: number;
} = {}): StateReport {
  return {
    timestamp: '2026-04-04T00:00:00Z',
    version: '1.0.0',
    git: {
      total_commits: 100,
      commits_last_7d: 10,
      commits_last_30d: 40,
      unique_authors_30d: 3,
      active_branches: 2,
      stale_branches: 0,
      last_commit_age_hours: 1,
      avg_commit_size_lines: 50,
    },
    quality: {
      test_file_count: 20,
      source_file_count: 40,
      test_ratio: 0.5,
      test_pass_rate: 1,
      test_coverage_percent: overrides.test_coverage_percent ?? 85,
      lint_error_count: overrides.lint_error_count ?? 0,
      files_exceeding_length_limit: [],
      functions_exceeding_complexity: [],
    },
    performance: {
      pulse_execution_ms: overrides.pulse_execution_ms ?? 500,
      hotspots_execution_ms: 400,
      ghosts_execution_ms: 300,
      benchmarked_against: 'v1.0.0',
    },
    dependencies: {
      total_count: 10,
      outdated_count: 0,
      vulnerable_count: 0,
      outdated_packages: [],
      vulnerabilities: [],
    },
    codebase: {
      total_files: 50,
      total_lines: 5000,
      avg_file_length: 100,
      largest_files: [],
      file_type_distribution: { ts: 40, json: 10 },
    },
    anomalies: [],
    growth_signals: [],
  };
}

// ── formatPRBody ────────────────────────────────────────────────────────

describe('formatPRBody', () => {
  it('includes the work item title in the heading', () => {
    const body = formatPRBody({
      workItem: makeWorkItem({ title: 'Add retry logic' }),
      cycleNumber: 5,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('Organism Change: Add retry logic');
  });

  it('includes agent and cycle info', () => {
    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 12,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('**Agent:** Motor Cortex');
    expect(body).toContain('**Cycle:** #12');
  });

  it('includes work item tier', () => {
    const body = formatPRBody({
      workItem: makeWorkItem({ tier: 3 }),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('**Work Item Tier:** 3');
  });

  it('includes description under What Changed heading', () => {
    const body = formatPRBody({
      workItem: makeWorkItem({ description: 'Refactored the config loader' }),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('### What Changed');
    expect(body).toContain('Refactored the config loader');
  });

  it('includes rationale under Why heading', () => {
    const body = formatPRBody({
      workItem: makeWorkItem({ rationale: 'Reduces complexity and bug surface' }),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('### Why');
    expect(body).toContain('Reduces complexity and bug surface');
  });

  it('includes immune system checks with correct icons', () => {
    const verdict = makeVerdict({
      checks: [
        makeCheck({ name: 'tests', status: 'pass', message: 'All passing' }),
        makeCheck({ name: 'coverage', status: 'warn', message: 'Low coverage' }),
        makeCheck({ name: 'security', status: 'fail', message: 'Vulnerability found' }),
      ],
    });

    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 1,
      verdict,
      stateReport: makeStateReport(),
    });

    expect(body).toContain('### Immune System Review');
    expect(body).toContain('\u2705 tests: All passing');
    expect(body).toContain('\u26A0\uFE0F coverage: Low coverage');
    expect(body).toContain('\u274C security: Vulnerability found');
  });

  it('includes approve verdict with confidence', () => {
    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 1,
      verdict: makeVerdict({ verdict: 'approve', confidence: 0.95 }),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('\u2705 APPROVED');
    expect(body).toContain('confidence: 0.95');
  });

  it('includes reject verdict', () => {
    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 1,
      verdict: makeVerdict({ verdict: 'reject', confidence: 0.3 }),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('\u274C REJECTED');
    expect(body).toContain('confidence: 0.3');
  });

  it('includes request-changes verdict', () => {
    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 1,
      verdict: makeVerdict({ verdict: 'request-changes', confidence: 0.6 }),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('\u26A0\uFE0F CHANGES REQUESTED');
    expect(body).toContain('confidence: 0.6');
  });

  it('includes memory context when non-empty', () => {
    const body = formatPRBody({
      workItem: makeWorkItem({ memory_context: ['lesson-1', 'lesson-2'] }),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('### Memory Context');
    expect(body).toContain('lesson-1, lesson-2');
  });

  it('omits memory context section when empty', () => {
    const body = formatPRBody({
      workItem: makeWorkItem({ memory_context: [] }),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).not.toContain('### Memory Context');
  });

  it('includes metrics table with state report values', () => {
    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport({
        test_coverage_percent: 92,
        lint_error_count: 3,
        pulse_execution_ms: 250,
      }),
    });

    expect(body).toContain('### Metrics');
    expect(body).toContain('| Test Coverage | 92% |');
    expect(body).toContain('| Lint Errors | 3 |');
    expect(body).toContain('| Pulse Perf | 250ms |');
  });

  it('includes footer about autonomous creation', () => {
    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).toContain('Living Codebase organism');
  });

  it('includes dashclaw URL when provided', () => {
    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
      dashclawUrl: 'https://dashclaw.example.com/org/1',
    });

    expect(body).toContain('[View the organism\'s dashboard](https://dashclaw.example.com/org/1)');
  });

  it('omits dashclaw link when URL not provided', () => {
    const body = formatPRBody({
      workItem: makeWorkItem(),
      cycleNumber: 1,
      verdict: makeVerdict(),
      stateReport: makeStateReport(),
    });

    expect(body).not.toContain('View the organism\'s dashboard');
  });
});

// ── formatPRTitle ───────────────────────────────────────────────────────

describe('formatPRTitle', () => {
  it('formats title with cycle number and work item title', () => {
    const title = formatPRTitle(makeWorkItem({ title: 'Add retry logic' }), 7);
    expect(title).toBe('organism(cycle-7): Add retry logic');
  });

  it('uses cycle 1 correctly', () => {
    const title = formatPRTitle(makeWorkItem({ title: 'Init' }), 1);
    expect(title).toBe('organism(cycle-1): Init');
  });
});

// ── getPRLabels ─────────────────────────────────────────────────────────

describe('getPRLabels', () => {
  it('includes organism label', () => {
    const labels = getPRLabels(makeWorkItem());
    expect(labels).toContain('organism');
  });

  it('includes auto-generated label', () => {
    const labels = getPRLabels(makeWorkItem());
    expect(labels).toContain('auto-generated');
  });

  it('includes tier label matching work item tier', () => {
    const labels = getPRLabels(makeWorkItem({ tier: 3 }));
    expect(labels).toContain('tier-3');
  });

  it('returns exactly 3 labels', () => {
    const labels = getPRLabels(makeWorkItem());
    expect(labels).toHaveLength(3);
  });

  it('uses tier-1 for tier 1 work items', () => {
    const labels = getPRLabels(makeWorkItem({ tier: 1 }));
    expect(labels).toContain('tier-1');
  });

  it('uses tier-5 for tier 5 work items', () => {
    const labels = getPRLabels(makeWorkItem({ tier: 5 }));
    expect(labels).toContain('tier-5');
  });
});
