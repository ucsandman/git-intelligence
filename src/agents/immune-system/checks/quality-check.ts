import type { CheckResult } from '../types.js';
import type { Baselines } from '../types.js';
import type { OrganismConfig } from '../../types.js';
import { runCommand } from '../../utils.js';
import { collectCodeQuality } from '../../sensory-cortex/collectors/code-quality.js';

export async function runQualityCheck(
  repoPath: string,
  baselines: Baselines | null,
  config: OrganismConfig,
): Promise<CheckResult> {
  const name = 'Quality';

  // 1. Run tsc --noEmit and count errors
  const tscResult = runCommand('npx', ['tsc', '--noEmit'], repoPath);
  const errorPattern = /error TS/g;
  const errorMatches = tscResult.stderr.match(errorPattern);
  const lintErrors = errorMatches ? errorMatches.length : 0;

  // 2. Check for new lint errors compared to baseline
  if (baselines && lintErrors > baselines.lint_errors) {
    const newErrors = lintErrors - baselines.lint_errors;
    return {
      name,
      status: 'fail',
      message: `${newErrors} new lint errors introduced`,
    };
  }

  // 3-4. Scan for file length and complexity violations
  const quality = await collectCodeQuality(
    repoPath,
    config.quality_standards.max_file_length,
    config.quality_standards.max_complexity_per_function,
  );

  const fileViolations = quality.files_exceeding_length_limit.length;
  const complexityViolations = quality.functions_exceeding_complexity.length;

  // 5. If any violations, warn
  if (fileViolations > 0 || complexityViolations > 0) {
    return {
      name,
      status: 'warn',
      message: `${fileViolations} files over length limit, ${complexityViolations} functions over complexity limit`,
    };
  }

  // 6. All good
  return {
    name,
    status: 'pass',
    message: `${lintErrors} lint errors, no files over limit`,
  };
}
