import type { Baselines } from './types.js';
import type { StateReport } from '../sensory-cortex/types.js';
import { readJsonFile, writeJsonFile, getOrganismPath } from '../utils.js';

export async function readBaselines(repoPath: string): Promise<Baselines | null> {
  return readJsonFile<Baselines>(getOrganismPath(repoPath, 'baselines.json'));
}

export async function writeBaselines(repoPath: string, baselines: Baselines): Promise<void> {
  await writeJsonFile(getOrganismPath(repoPath, 'baselines.json'), baselines);
}

export function createBaselinesFromReport(report: StateReport): Baselines {
  return {
    last_updated: new Date().toISOString(),
    test_coverage: report.quality.test_coverage_percent,
    test_count: report.quality.test_file_count,
    lint_errors: report.quality.lint_error_count,
    performance: {
      pulse_ms: report.performance.pulse_execution_ms,
      hotspots_ms: report.performance.hotspots_execution_ms,
      ghosts_ms: report.performance.ghosts_execution_ms,
    },
    complexity: {
      total: report.codebase.total_lines,
      avg_per_file: report.codebase.avg_file_length,
    },
    dependency_count: report.dependencies.total_count,
    file_count: report.codebase.total_files,
    total_lines: report.codebase.total_lines,
  };
}
