import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runFieldObservation } from '../../../src/agents/field-observer/runner.js';
import { createTempRepo, commitFile, type TempRepo } from './helpers.js';

describe('runFieldObservation', () => {
  let repo: TempRepo;

  beforeEach(async () => {
    repo = await createTempRepo();
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  it('returns a complete observation for a clean repo', async () => {
    const result = await runFieldObservation({ slug: 'sample', path: repo.path, enabled: true });

    expect(result.partial).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.pulse.repoName).toBeDefined();
    expect(result.pulse.weeklyCommits.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.hotspots.hotspots)).toBe(true);
    expect(Array.isArray(result.ghosts.staleBranches)).toBe(true);
  });

  it('reflects new commits in weeklyCommits', async () => {
    commitFile(repo.path, 'src/a.ts', 'export const a = 1;\n', 'feat: add a');
    commitFile(repo.path, 'src/b.ts', 'export const b = 2;\n', 'feat: add b');

    const result = await runFieldObservation({ slug: 'sample', path: repo.path, enabled: true });

    expect(result.pulse.weeklyCommits.count).toBeGreaterThanOrEqual(3);
  });

  it('returns partial=true when one analyzer times out', async () => {
    const result = await runFieldObservation(
      { slug: 'sample', path: repo.path, enabled: true },
      { perAnalyzerTimeoutMs: 1 },
    );

    expect(result.partial).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('timed out after 1ms'))).toBe(true);
  });
});
