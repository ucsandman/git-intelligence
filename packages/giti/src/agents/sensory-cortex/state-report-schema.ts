import type { StateReport } from './types.js';

/**
 * Type guard for reports that have the nested shape trend detection reads.
 *
 * giti's `.organism/state-reports/` directory can contain reports written by a
 * different organism. Loading those into `detectTrends` crashes because the
 * extractors assume giti's StateReport shape.
 */
export function isValidStateReport(value: unknown): value is StateReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;

  if (typeof r.timestamp !== 'string') return false;

  const requiredNumbers: Array<[keyof StateReport, string]> = [
    ['quality', 'test_coverage_percent'],
    ['quality', 'lint_error_count'],
    ['performance', 'pulse_execution_ms'],
    ['performance', 'hotspots_execution_ms'],
    ['performance', 'ghosts_execution_ms'],
    ['codebase', 'total_lines'],
  ];

  for (const [parentKey, fieldKey] of requiredNumbers) {
    const parent = r[parentKey];
    if (!parent || typeof parent !== 'object') return false;
    if (typeof (parent as Record<string, unknown>)[fieldKey] !== 'number') return false;
  }

  return true;
}
