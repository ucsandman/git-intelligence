import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readBaselines, writeBaselines, createBaselinesFromReport } from '../../../src/agents/immune-system/baselines.js';
import type { Baselines } from '../../../src/agents/immune-system/types.js';
import type { StateReport } from '../../../src/agents/sensory-cortex/types.js';

// ── helpers ─────────────────────────────────────────────────────────

function makeReport(): StateReport {
  return {
    timestamp: '2026-04-04T10:00:00.000Z',
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
  };
}

// ── tests ───────────────────────────────────────────────────────────

describe('readBaselines', () => {
  it('returns null for missing file', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-baselines-'));
    try {
      const result = await readBaselines(tmpDir);
      expect(result).toBeNull();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('writeBaselines / readBaselines round-trip', () => {
  it('round-trips correctly', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-baselines-'));
    try {
      const baselines: Baselines = {
        last_updated: '2026-04-04T10:00:00.000Z',
        test_coverage: 85,
        test_count: 10,
        lint_errors: 0,
        performance: {
          pulse_ms: 300,
          hotspots_ms: 1200,
          ghosts_ms: 800,
        },
        complexity: {
          total: 3000,
          avg_per_file: 100,
        },
        dependency_count: 10,
        file_count: 30,
        total_lines: 3000,
      };

      await writeBaselines(tmpDir, baselines);
      const loaded = await readBaselines(tmpDir);

      expect(loaded).toEqual(baselines);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('createBaselinesFromReport', () => {
  it('maps all fields correctly from a known StateReport', () => {
    const report = makeReport();
    const baselines = createBaselinesFromReport(report);

    expect(baselines.test_coverage).toBe(85);
    expect(baselines.test_count).toBe(10);
    expect(baselines.lint_errors).toBe(0);
    expect(baselines.performance.pulse_ms).toBe(300);
    expect(baselines.performance.hotspots_ms).toBe(1200);
    expect(baselines.performance.ghosts_ms).toBe(800);
    expect(baselines.complexity.total).toBe(3000);
    expect(baselines.complexity.avg_per_file).toBe(100);
    expect(baselines.dependency_count).toBe(10);
    expect(baselines.file_count).toBe(30);
    expect(baselines.total_lines).toBe(3000);
    expect(baselines.last_updated).toBeDefined();
    // last_updated should be a valid ISO string
    expect(() => new Date(baselines.last_updated)).not.toThrow();
    expect(new Date(baselines.last_updated).toISOString()).toBe(baselines.last_updated);
  });
});
