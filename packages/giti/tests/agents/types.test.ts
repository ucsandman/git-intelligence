import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadOrganismConfig } from '../../src/agents/utils.js';

describe('OrganismConfig field_targets and narrator', () => {
  it('loads field_targets from organism.json with a practical-systems entry', async () => {
    const config = await loadOrganismConfig(path.resolve(__dirname, '..', '..', '..', '..'));
    expect(config.field_targets).toBeDefined();
    expect(Array.isArray(config.field_targets)).toBe(true);
    expect(config.field_targets!.length).toBeGreaterThanOrEqual(1);
    const practical = config.field_targets!.find((t) => t.slug === 'practical-systems');
    expect(practical).toBeDefined();
    expect(practical!.path).toBe('C:\\Projects\\Practical Systems');
    expect(practical!.enabled).toBe(true);
  });

  it('loads narrator config with enabled=true and a haiku model', async () => {
    const config = await loadOrganismConfig(path.resolve(__dirname, '..', '..', '..', '..'));
    expect(config.narrator).toBeDefined();
    expect(config.narrator!.enabled).toBe(true);
    expect(config.narrator!.model).toMatch(/haiku/i);
    expect(config.narrator!.max_tokens).toBeGreaterThan(0);
  });
});
