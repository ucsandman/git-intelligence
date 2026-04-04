import { describe, it, expect } from 'vitest';
import type { StateReport, OutdatedPackage, Anomaly } from '../../../src/agents/sensory-cortex/types.js';
import type { OrganismConfig } from '../../../src/agents/types.js';
import type { KnowledgeBase } from '../../../src/agents/memory/types.js';
import { generateWorkItems, prioritizeItems } from '../../../src/agents/prefrontal-cortex/prioritizer.js';

// ── helpers ─────────────────────────────────────────────────────────

function makeReport(overrides: Partial<StateReport> = {}): StateReport {
  return {
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    git: {
      total_commits: 100,
      commits_last_7d: 10,
      commits_last_30d: 40,
      unique_authors_30d: 3,
      active_branches: 5,
      stale_branches: 1,
      last_commit_age_hours: 2,
      avg_commit_size_lines: 30,
    },
    quality: {
      test_file_count: 10,
      source_file_count: 15,
      test_ratio: 0.67,
      test_pass_rate: 1,
      test_coverage_percent: 85,
      lint_error_count: 0,
      files_exceeding_length_limit: [],
      functions_exceeding_complexity: [],
    },
    performance: {
      pulse_execution_ms: 300,
      hotspots_execution_ms: 1200,
      ghosts_execution_ms: 800,
      benchmarked_against: '/repo',
    },
    dependencies: {
      total_count: 10,
      outdated_count: 0,
      vulnerable_count: 0,
      outdated_packages: [],
      vulnerabilities: [],
    },
    codebase: {
      total_files: 30,
      total_lines: 3000,
      avg_file_length: 100,
      largest_files: [],
      file_type_distribution: {},
    },
    anomalies: [],
    growth_signals: [],
    ...overrides,
  };
}

const mockConfig: OrganismConfig = {
  quality_standards: {
    test_coverage_floor: 80,
    max_complexity_per_function: 15,
    max_file_length: 300,
    zero_tolerance: [],
    performance_budget: {
      pulse_command: '< 2 seconds on repos up to 10k commits',
      hotspots_command: '< 5 seconds on repos up to 10k commits',
      any_new_command: '< 10 seconds on repos up to 10k commits',
    },
  },
  boundaries: { growth_zone: [], forbidden_zone: [] },
  lifecycle: {
    cycle_frequency: 'daily',
    max_changes_per_cycle: 3,
    mandatory_cooldown_after_regression: '48 hours',
    branch_naming: 'organism/{cortex}/{description}',
    requires_immune_approval: true,
  },
};

function makeKb(fragileFiles: string[] = []): KnowledgeBase {
  return {
    created: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    cycle_count: 5,
    events: [],
    lessons: [
      {
        id: 'lesson-001',
        learned_at: new Date().toISOString(),
        lesson: 'This file tends to break tests',
        evidence_event_ids: ['evt-1'],
        confidence: 0.9,
        category: 'quality',
        times_referenced: 3,
      },
    ],
    patterns: {
      fragile_files: fragileFiles.map((p) => ({
        path: p,
        regression_count: 3,
        last_regression: new Date().toISOString(),
        notes: 'Known fragile file',
      })),
      rejection_reasons: {},
      successful_change_types: {},
      failed_change_types: {},
    },
    preferences: [],
  };
}

// ── generateWorkItems ───────────────────────────────────────────────

describe('generateWorkItems', () => {
  it('generates Tier 1 item for vulnerabilities', () => {
    const report = makeReport({
      dependencies: {
        total_count: 10,
        outdated_count: 0,
        vulnerable_count: 3,
        outdated_packages: [],
        vulnerabilities: [
          { package: 'foo', severity: 'high', description: 'RCE' },
          { package: 'bar', severity: 'medium', description: 'XSS' },
          { package: 'baz', severity: 'low', description: 'DOS' },
        ],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const vulnItem = items.find((i) => i.title.includes('security vulnerabilit'));

    expect(vulnItem).toBeDefined();
    expect(vulnItem!.tier).toBe(1);
    expect(vulnItem!.priority_score).toBe(100);
    expect(vulnItem!.title).toContain('3');
    expect(vulnItem!.target_files).toContain('package.json');
    expect(vulnItem!.status).toBe('proposed');
    expect(vulnItem!.created_by).toBe('prefrontal-cortex');
    expect(vulnItem!.estimated_complexity).toBe('medium');
    expect(vulnItem!.success_criteria.length).toBeGreaterThan(0);
  });

  it('generates Tier 1 item for lint errors', () => {
    const report = makeReport({
      quality: {
        test_file_count: 10,
        source_file_count: 15,
        test_ratio: 0.67,
        test_pass_rate: 1,
        test_coverage_percent: 85,
        lint_error_count: 12,
        files_exceeding_length_limit: [],
        functions_exceeding_complexity: [],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const lintItem = items.find((i) => i.title.includes('lint error'));

    expect(lintItem).toBeDefined();
    expect(lintItem!.tier).toBe(1);
    expect(lintItem!.priority_score).toBe(95);
    expect(lintItem!.title).toContain('12');
    expect(lintItem!.estimated_complexity).toBe('medium');
  });

  it('generates Tier 1 item for test failures (pass_rate < 1)', () => {
    const report = makeReport({
      quality: {
        test_file_count: 10,
        source_file_count: 15,
        test_ratio: 0.67,
        test_pass_rate: 0.85,
        test_coverage_percent: 85,
        lint_error_count: 0,
        files_exceeding_length_limit: [],
        functions_exceeding_complexity: [],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const testItem = items.find((i) => i.title.includes('failing test'));

    expect(testItem).toBeDefined();
    expect(testItem!.tier).toBe(1);
    expect(testItem!.priority_score).toBe(90);
    expect(testItem!.estimated_complexity).toBe('medium');
  });

  it('generates Tier 2 item for performance regression (>80% of budget)', () => {
    const report = makeReport({
      performance: {
        pulse_execution_ms: 1800, // 90% of 2000ms budget
        hotspots_execution_ms: 1200,
        ghosts_execution_ms: 800,
        benchmarked_against: '/repo',
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const perfItem = items.find((i) => i.title.toLowerCase().includes('pulse'));

    expect(perfItem).toBeDefined();
    expect(perfItem!.tier).toBe(2);
    // priority = round((1800 / 2000) * 100) = 90
    expect(perfItem!.priority_score).toBe(90);
  });

  it('generates Tier 2 item for coverage below floor', () => {
    const report = makeReport({
      quality: {
        test_file_count: 10,
        source_file_count: 15,
        test_ratio: 0.67,
        test_pass_rate: 1,
        test_coverage_percent: 72,
        lint_error_count: 0,
        files_exceeding_length_limit: [],
        functions_exceeding_complexity: [],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const covItem = items.find((i) => i.title.includes('test coverage'));

    expect(covItem).toBeDefined();
    expect(covItem!.tier).toBe(2);
    expect(covItem!.priority_score).toBe(80);
    expect(covItem!.title).toContain('72%');
    expect(covItem!.title).toContain('80%');
  });

  it('generates Tier 3 items for outdated packages', () => {
    const report = makeReport({
      dependencies: {
        total_count: 10,
        outdated_count: 3,
        vulnerable_count: 0,
        outdated_packages: [
          { name: 'lodash', current: '4.17.20', latest: '4.17.21', severity: 'patch' },
          { name: 'express', current: '4.17.0', latest: '4.18.0', severity: 'minor' },
          { name: 'react', current: '17.0.0', latest: '18.0.0', severity: 'major' },
        ],
        vulnerabilities: [],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const patchItem = items.find((i) => i.title.includes('lodash'));
    const minorItem = items.find((i) => i.title.includes('express'));
    const majorItem = items.find((i) => i.title.includes('react'));

    expect(patchItem).toBeDefined();
    expect(patchItem!.tier).toBe(3);
    expect(patchItem!.priority_score).toBe(30);

    expect(minorItem).toBeDefined();
    expect(minorItem!.tier).toBe(3);
    expect(minorItem!.priority_score).toBe(50);

    // Major versions should NOT generate items
    expect(majorItem).toBeUndefined();
  });

  it('generates Tier 3 items for files over length limit', () => {
    const report = makeReport({
      quality: {
        test_file_count: 10,
        source_file_count: 15,
        test_ratio: 0.67,
        test_pass_rate: 1,
        test_coverage_percent: 85,
        lint_error_count: 0,
        files_exceeding_length_limit: ['src/big-file.ts', 'src/another-big.ts'],
        functions_exceeding_complexity: [],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const fileItems = items.filter((i) => i.title.includes('Split/reduce'));

    expect(fileItems).toHaveLength(2);
    expect(fileItems[0]!.tier).toBe(3);
    expect(fileItems[0]!.priority_score).toBe(40);
    expect(fileItems[0]!.target_files.length).toBeGreaterThan(0);
  });

  it('generates Tier 3 items for functions exceeding complexity', () => {
    const report = makeReport({
      quality: {
        test_file_count: 10,
        source_file_count: 15,
        test_ratio: 0.67,
        test_pass_rate: 1,
        test_coverage_percent: 85,
        lint_error_count: 0,
        files_exceeding_length_limit: [],
        functions_exceeding_complexity: ['parseConfig', 'handleRequest'],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const complexityItems = items.filter((i) => i.title.includes('Reduce complexity'));

    expect(complexityItems).toHaveLength(2);
    expect(complexityItems[0]!.tier).toBe(3);
    expect(complexityItems[0]!.priority_score).toBe(35);
  });

  it('does NOT generate items when everything is healthy', () => {
    const report = makeReport();
    const items = generateWorkItems(report, mockConfig, null);
    expect(items).toHaveLength(0);
  });

  it('empty state report generates no items', () => {
    const report = makeReport({
      dependencies: {
        total_count: 0,
        outdated_count: 0,
        vulnerable_count: 0,
        outdated_packages: [],
        vulnerabilities: [],
      },
      quality: {
        test_file_count: 0,
        source_file_count: 0,
        test_ratio: 0,
        test_pass_rate: 1,
        test_coverage_percent: 100,
        lint_error_count: 0,
        files_exceeding_length_limit: [],
        functions_exceeding_complexity: [],
      },
      anomalies: [],
    });

    const items = generateWorkItems(report, mockConfig, null);
    expect(items).toHaveLength(0);
  });

  it('populates memory context when fragile files match targets', () => {
    const report = makeReport({
      quality: {
        test_file_count: 10,
        source_file_count: 15,
        test_ratio: 0.67,
        test_pass_rate: 1,
        test_coverage_percent: 85,
        lint_error_count: 0,
        files_exceeding_length_limit: ['src/fragile.ts'],
        functions_exceeding_complexity: [],
      },
    });

    const kb = makeKb(['src/fragile.ts']);
    const items = generateWorkItems(report, mockConfig, kb);

    const fileItem = items.find((i) => i.target_files.includes('src/fragile.ts'));
    expect(fileItem).toBeDefined();
    expect(fileItem!.memory_context.length).toBeGreaterThan(0);
    expect(fileItem!.description).toContain('fragile');
  });

  it('generates Tier 2 items for critical anomalies', () => {
    const anomaly: Anomaly = {
      type: 'complexity_spike',
      severity: 'critical',
      message: 'Complexity spike in src/parser.ts',
      data: { file: 'src/parser.ts' },
    };
    const report = makeReport({ anomalies: [anomaly] });

    const items = generateWorkItems(report, mockConfig, null);
    const anomalyItem = items.find((i) => i.title.includes('anomaly') || i.title.includes('Complexity spike'));

    expect(anomalyItem).toBeDefined();
    expect(anomalyItem!.tier).toBe(2);
  });
});

// ── prioritizeItems ─────────────────────────────────────────────────

describe('prioritizeItems', () => {
  it('Tier 1 items always sorted before Tier 2', () => {
    const report = makeReport({
      dependencies: {
        total_count: 10,
        outdated_count: 0,
        vulnerable_count: 5,
        outdated_packages: [],
        vulnerabilities: [
          { package: 'foo', severity: 'high', description: 'RCE' },
        ],
      },
      quality: {
        test_file_count: 10,
        source_file_count: 15,
        test_ratio: 0.67,
        test_pass_rate: 1,
        test_coverage_percent: 72,
        lint_error_count: 0,
        files_exceeding_length_limit: [],
        functions_exceeding_complexity: [],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const { selected } = prioritizeItems(items, 10, false);

    const tier1Idx = selected.findIndex((i) => i.tier === 1);
    const tier2Idx = selected.findIndex((i) => i.tier === 2);

    expect(tier1Idx).toBeGreaterThanOrEqual(0);
    expect(tier2Idx).toBeGreaterThanOrEqual(0);
    expect(tier1Idx).toBeLessThan(tier2Idx);
  });

  it('respects maxItems limit', () => {
    const report = makeReport({
      dependencies: {
        total_count: 10,
        outdated_count: 5,
        vulnerable_count: 2,
        outdated_packages: [
          { name: 'a', current: '1.0.0', latest: '1.0.1', severity: 'patch' },
          { name: 'b', current: '1.0.0', latest: '1.1.0', severity: 'minor' },
          { name: 'c', current: '1.0.0', latest: '1.0.2', severity: 'patch' },
          { name: 'd', current: '1.0.0', latest: '1.2.0', severity: 'minor' },
          { name: 'e', current: '1.0.0', latest: '1.0.3', severity: 'patch' },
        ],
        vulnerabilities: [
          { package: 'x', severity: 'high', description: 'vuln1' },
          { package: 'y', severity: 'high', description: 'vuln2' },
        ],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    expect(items.length).toBeGreaterThan(3);

    const { selected, deferred } = prioritizeItems(items, 3, false);

    expect(selected).toHaveLength(3);
    expect(deferred.length).toBe(items.length - 3);
    expect(selected.every((i) => i.status === 'planned')).toBe(true);
  });

  it('during cooldown filters to Tier 1-2 only', () => {
    const report = makeReport({
      dependencies: {
        total_count: 10,
        outdated_count: 2,
        vulnerable_count: 1,
        outdated_packages: [
          { name: 'a', current: '1.0.0', latest: '1.0.1', severity: 'patch' },
          { name: 'b', current: '1.0.0', latest: '1.1.0', severity: 'minor' },
        ],
        vulnerabilities: [
          { package: 'x', severity: 'high', description: 'vuln' },
        ],
      },
      quality: {
        test_file_count: 10,
        source_file_count: 15,
        test_ratio: 0.67,
        test_pass_rate: 1,
        test_coverage_percent: 72,
        lint_error_count: 0,
        files_exceeding_length_limit: [],
        functions_exceeding_complexity: [],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    // Should have Tier 1 (vuln) + Tier 2 (coverage) + Tier 3 (outdated pkgs)
    const tier3Count = items.filter((i) => i.tier === 3).length;
    expect(tier3Count).toBeGreaterThan(0);

    const { selected, deferred } = prioritizeItems(items, 10, true);

    // No Tier 3 in selected when in cooldown
    expect(selected.every((i) => i.tier <= 2)).toBe(true);
    // Tier 3 items are in deferred
    expect(deferred.filter((i) => i.tier === 3).length).toBe(tier3Count);
  });

  it('sets selected items status to planned', () => {
    const report = makeReport({
      dependencies: {
        total_count: 10,
        outdated_count: 0,
        vulnerable_count: 2,
        outdated_packages: [],
        vulnerabilities: [
          { package: 'x', severity: 'high', description: 'vuln' },
        ],
      },
    });

    const items = generateWorkItems(report, mockConfig, null);
    const { selected } = prioritizeItems(items, 10, false);

    expect(selected.length).toBeGreaterThan(0);
    for (const item of selected) {
      expect(item.status).toBe('planned');
    }
  });

  it('returns empty selected and deferred for empty input', () => {
    const { selected, deferred } = prioritizeItems([], 5, false);
    expect(selected).toHaveLength(0);
    expect(deferred).toHaveLength(0);
  });
});
