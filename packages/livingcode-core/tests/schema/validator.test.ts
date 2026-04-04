import { describe, it, expect } from 'vitest';
import { validateOrganismConfig } from '../../src/schema/validator.js';

function validConfig() {
  return {
    identity: { name: 'test', purpose: 'testing' },
    boundaries: {
      growth_zone: ['testing'],
      forbidden_zone: ['nothing'],
    },
    quality_standards: {
      test_coverage_floor: 80,
      max_complexity_per_function: 15,
      max_file_length: 300,
      zero_tolerance: [],
      performance_budget: {},
    },
    lifecycle: {
      max_changes_per_cycle: 3,
      requires_immune_approval: true,
    },
    evolutionary_principles: ['test principle'],
  };
}

describe('validateOrganismConfig', () => {
  it('accepts a valid config', () => {
    const result = validateOrganismConfig(validConfig());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects null config', () => {
    const result = validateOrganismConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Config must be a non-null object');
  });

  it('reports missing identity', () => {
    const cfg = validConfig();
    delete (cfg as Record<string, unknown>)['identity'];
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: identity');
  });

  it('reports empty identity.name', () => {
    const cfg = validConfig();
    cfg.identity.name = '';
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'identity.name must be a non-empty string',
    );
  });

  it('reports missing boundaries', () => {
    const cfg = validConfig();
    delete (cfg as Record<string, unknown>)['boundaries'];
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: boundaries');
  });

  it('reports empty growth_zone array', () => {
    const cfg = validConfig();
    cfg.boundaries.growth_zone = [];
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'boundaries.growth_zone must be a non-empty array',
    );
  });

  it('reports empty forbidden_zone array', () => {
    const cfg = validConfig();
    cfg.boundaries.forbidden_zone = [];
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'boundaries.forbidden_zone must be a non-empty array',
    );
  });

  it('reports missing quality_standards', () => {
    const cfg = validConfig();
    delete (cfg as Record<string, unknown>)['quality_standards'];
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: quality_standards');
  });

  it('reports test_coverage_floor above 100', () => {
    const cfg = validConfig();
    cfg.quality_standards.test_coverage_floor = 101;
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'quality_standards.test_coverage_floor must be a number between 0 and 100',
    );
  });

  it('reports negative test_coverage_floor', () => {
    const cfg = validConfig();
    cfg.quality_standards.test_coverage_floor = -1;
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'quality_standards.test_coverage_floor must be a number between 0 and 100',
    );
  });

  it('reports max_complexity_per_function < 1', () => {
    const cfg = validConfig();
    cfg.quality_standards.max_complexity_per_function = 0;
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'quality_standards.max_complexity_per_function must be a number >= 1',
    );
  });

  it('reports max_file_length < 1', () => {
    const cfg = validConfig();
    cfg.quality_standards.max_file_length = 0;
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'quality_standards.max_file_length must be a number >= 1',
    );
  });

  it('reports lifecycle.max_changes_per_cycle < 1', () => {
    const cfg = validConfig();
    cfg.lifecycle.max_changes_per_cycle = 0;
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'lifecycle.max_changes_per_cycle must be a number >= 1',
    );
  });

  it('reports non-string evolutionary principle', () => {
    const cfg = validConfig();
    (cfg.evolutionary_principles as unknown[]) = ['valid', 42];
    const result = validateOrganismConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'evolutionary_principles must contain only non-empty strings',
    );
  });

  it('reports multiple errors simultaneously', () => {
    const result = validateOrganismConfig({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors).toContain('Missing required field: identity');
    expect(result.errors).toContain('Missing required field: boundaries');
    expect(result.errors).toContain('Missing required field: quality_standards');
  });
});
