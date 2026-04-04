export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOrganismConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Config must be a non-null object'] };
  }

  const obj = config as Record<string, unknown>;

  // Identity
  if (!obj['identity'] || typeof obj['identity'] !== 'object') {
    errors.push('Missing required field: identity');
  } else {
    const id = obj['identity'] as Record<string, unknown>;
    if (typeof id['name'] !== 'string' || id['name'].length === 0) {
      errors.push('identity.name must be a non-empty string');
    }
    if (typeof id['purpose'] !== 'string' || id['purpose'].length === 0) {
      errors.push('identity.purpose must be a non-empty string');
    }
  }

  // Boundaries
  if (!obj['boundaries'] || typeof obj['boundaries'] !== 'object') {
    errors.push('Missing required field: boundaries');
  } else {
    const b = obj['boundaries'] as Record<string, unknown>;
    if (!Array.isArray(b['growth_zone']) || b['growth_zone'].length === 0) {
      errors.push('boundaries.growth_zone must be a non-empty array');
    }
    if (!Array.isArray(b['forbidden_zone']) || b['forbidden_zone'].length === 0) {
      errors.push('boundaries.forbidden_zone must be a non-empty array');
    }
  }

  // Quality standards
  if (!obj['quality_standards'] || typeof obj['quality_standards'] !== 'object') {
    errors.push('Missing required field: quality_standards');
  } else {
    const qs = obj['quality_standards'] as Record<string, unknown>;
    if (
      typeof qs['test_coverage_floor'] !== 'number' ||
      qs['test_coverage_floor'] < 0 ||
      qs['test_coverage_floor'] > 100
    ) {
      errors.push(
        'quality_standards.test_coverage_floor must be a number between 0 and 100',
      );
    }
    if (
      typeof qs['max_complexity_per_function'] !== 'number' ||
      qs['max_complexity_per_function'] < 1
    ) {
      errors.push(
        'quality_standards.max_complexity_per_function must be a number >= 1',
      );
    }
    if (
      typeof qs['max_file_length'] !== 'number' ||
      qs['max_file_length'] < 1
    ) {
      errors.push('quality_standards.max_file_length must be a number >= 1');
    }
  }

  // Lifecycle
  if (obj['lifecycle'] && typeof obj['lifecycle'] === 'object') {
    const lc = obj['lifecycle'] as Record<string, unknown>;
    if (
      'max_changes_per_cycle' in lc &&
      (typeof lc['max_changes_per_cycle'] !== 'number' ||
        (lc['max_changes_per_cycle'] as number) < 1)
    ) {
      errors.push('lifecycle.max_changes_per_cycle must be a number >= 1');
    }
  }

  // Evolutionary principles
  if (obj['evolutionary_principles'] !== undefined) {
    if (!Array.isArray(obj['evolutionary_principles'])) {
      errors.push('evolutionary_principles must be an array');
    } else if (
      obj['evolutionary_principles'].some(
        (p: unknown) => typeof p !== 'string' || (p as string).length === 0,
      )
    ) {
      errors.push(
        'evolutionary_principles must contain only non-empty strings',
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
