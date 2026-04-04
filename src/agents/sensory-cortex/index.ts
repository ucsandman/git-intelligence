import path from 'node:path';
import fs from 'node:fs/promises';
import { createGitClient } from '../../utils/git.js';
import { loadOrganismConfig, readJsonFile, writeJsonFile, ensureOrganismDir, getOrganismPath } from '../utils.js';
import { collectGitStats } from './collectors/git-stats.js';
import { collectTestHealth } from './collectors/test-health.js';
import { collectCodeQuality } from './collectors/code-quality.js';
import { collectDependencyHealth } from './collectors/dependency-health.js';
import { collectPerformance } from './collectors/performance.js';
import { detectTrends, detectAnomalies } from './analyzers/trend-detector.js';
import type { StateReport } from './types.js';

const REPORTS_SUBDIR = 'state-reports';

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.organism']);

/**
 * Walk the filesystem to gather codebase-level statistics:
 * total files, total lines, largest files, and file type distribution.
 */
async function scanCodebase(repoPath: string): Promise<StateReport['codebase']> {
  const files: Array<{ relativePath: string; lines: number; ext: string }> = [];
  await walkAll(repoPath, repoPath, files);

  let totalLines = 0;
  const distribution: Record<string, number> = {};
  for (const file of files) {
    totalLines += file.lines;
    distribution[file.ext] = (distribution[file.ext] ?? 0) + 1;
  }

  const totalFiles = files.length;
  const avgFileLength = totalFiles > 0 ? Math.round(totalLines / totalFiles) : 0;

  // Largest files (top 10)
  const sorted = [...files].sort((a, b) => b.lines - a.lines);
  const largestFiles = sorted.slice(0, 10).map((f) => ({
    path: f.relativePath,
    lines: f.lines,
  }));

  return {
    total_files: totalFiles,
    total_lines: totalLines,
    avg_file_length: avgFileLength,
    largest_files: largestFiles,
    file_type_distribution: distribution,
  };
}

async function walkAll(
  dir: string,
  repoPath: string,
  results: Array<{ relativePath: string; lines: number; ext: string }>,
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') {
      // Skip hidden dirs like .git, .organism, but let walkAll handle EXCLUDED_DIRS
      if (entry.isDirectory()) continue;
    }
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkAll(fullPath, repoPath, results);
    } else {
      const ext = path.extname(entry.name) || '(no ext)';
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lineCount = content.split('\n').length;
        results.push({
          relativePath: path.relative(repoPath, fullPath),
          lines: lineCount,
          ext,
        });
      } catch {
        // Skip unreadable files (binary, permissions, etc.)
      }
    }
  }
}

/**
 * Load all historical state reports from the .organism/state-reports/ directory.
 * Returns them sorted by timestamp ascending.
 */
async function loadHistoricalReports(repoPath: string): Promise<StateReport[]> {
  const reportsDir = getOrganismPath(repoPath, REPORTS_SUBDIR);

  let entries: string[];
  try {
    entries = await fs.readdir(reportsDir);
  } catch {
    return [];
  }

  const reports: StateReport[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const report = await readJsonFile<StateReport>(path.join(reportsDir, entry));
    if (report?.timestamp) {
      reports.push(report);
    }
  }

  reports.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return reports;
}

/**
 * Main orchestrator: runs all collectors, detects trends and anomalies,
 * assembles a StateReport, writes it to disk, and returns it.
 */
export async function runSensoryCortex(repoPath: string): Promise<{ report: StateReport; reportPath: string }> {
  // 1. Load config
  const config = await loadOrganismConfig(repoPath);

  // 2. Create git client
  const git = createGitClient(repoPath);

  // 3. Read package.json version
  const pkg = await readJsonFile<{ version?: string }>(path.join(repoPath, 'package.json'));
  const version = pkg?.version ?? '0.0.0';

  // 4. Run all 5 collectors + codebase scan in parallel
  const [gitStats, testHealth, codeQuality, depHealth, perf, codebase] = await Promise.all([
    collectGitStats(git),
    collectTestHealth(repoPath),
    collectCodeQuality(
      repoPath,
      config.quality_standards.max_file_length,
      config.quality_standards.max_complexity_per_function,
    ),
    collectDependencyHealth(repoPath),
    collectPerformance(repoPath),
    scanCodebase(repoPath),
  ]);

  // 5. Merge test-health + code-quality into unified quality section
  const quality: StateReport['quality'] = {
    test_file_count: codeQuality.test_file_count,
    source_file_count: codeQuality.source_file_count,
    test_ratio: codeQuality.test_ratio,
    test_pass_rate: testHealth.test_pass_rate,
    test_coverage_percent: testHealth.test_coverage_percent,
    lint_error_count: testHealth.lint_error_count,
    files_exceeding_length_limit: codeQuality.files_exceeding_length_limit,
    functions_exceeding_complexity: codeQuality.functions_exceeding_complexity,
  };

  // 6. Timestamp for report
  const timestamp = new Date().toISOString();

  // 7. Assemble partial report (without anomalies) for trend detection
  const partialReport: StateReport = {
    timestamp,
    version,
    git: gitStats,
    quality,
    performance: perf,
    dependencies: depHealth,
    codebase,
    anomalies: [],
    growth_signals: [],
  };

  // 8. Load historical reports, detect trends and anomalies
  const historical = await loadHistoricalReports(repoPath);
  const allReports = [...historical, partialReport];
  const trends = detectTrends(allReports);
  const anomalies = detectAnomalies(partialReport, trends, config);

  // 9. Assemble final report
  const report: StateReport = {
    ...partialReport,
    anomalies,
    // Growth signals left empty — Growth Hormone agent not yet built
    growth_signals: [],
  };

  // 10. Write report to disk
  await ensureOrganismDir(repoPath, REPORTS_SUBDIR);
  const reportPath = getOrganismPath(repoPath, REPORTS_SUBDIR, `${timestamp}.json`);
  await writeJsonFile(reportPath, report);

  // 11. Return
  return { report, reportPath };
}
