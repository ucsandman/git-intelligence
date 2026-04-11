import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeFieldReport, readLatestReport } from '../../../src/agents/field-observer/reporter.js';
import type { FieldObservation } from '../../../src/agents/field-observer/types.js';

function fakeObservation(overrides: Partial<FieldObservation> = {}): FieldObservation {
  return {
    target: 'sample',
    targetPath: '/tmp/sample',
    observedAt: '2026-04-11T09:00:00.000Z',
    cycle: 42,
    pulse: { repoName: 'sample', lastCommit: { date: new Date(), message: 'init', author: 'A' }, weeklyCommits: { count: 3, authorCount: 1 }, branches: { active: 1, stale: 0 }, hottestFile: null, testRatio: { testFiles: 1, sourceFiles: 2, percentage: 50 }, avgCommitSize: 10, busFactor: { count: 1, topAuthorsPercentage: 100, topAuthorCount: 1 } },
    hotspots: { period: '30d', hotspots: [], couplings: [] },
    ghosts: { staleBranches: [], deadCode: [] },
    narrative: '# Field note\n\nAll quiet.',
    mood: 'attentive',
    partial: false,
    errors: [],
    ...overrides,
  };
}

describe('writeFieldReport + readLatestReport', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'giti-fo-reporter-'));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('writes both .md and .json with identical basenames', async () => {
    const obs = fakeObservation();
    const result = await writeFieldReport(tmp, obs);

    expect(result.mdPath).toMatch(/\.md$/);
    expect(result.jsonPath).toMatch(/\.json$/);

    const mdExists = await fs.stat(result.mdPath).then(() => true).catch(() => false);
    const jsonExists = await fs.stat(result.jsonPath).then(() => true).catch(() => false);

    expect(mdExists).toBe(true);
    expect(jsonExists).toBe(true);
  });

  it('updates latest.json to match most recent report', async () => {
    const first = fakeObservation({ observedAt: '2026-04-11T08:00:00.000Z', mood: 'attentive' });
    const second = fakeObservation({ observedAt: '2026-04-11T09:00:00.000Z', mood: 'curious' });

    await writeFieldReport(tmp, first);
    await writeFieldReport(tmp, second);

    const latest = await readLatestReport(tmp, 'sample');
    expect(latest).not.toBeNull();
    expect(latest!.mood).toBe('curious');
    expect(latest!.observedAt).toBe('2026-04-11T09:00:00.000Z');
  });

  it('returns null from readLatestReport when no reports exist', async () => {
    const latest = await readLatestReport(tmp, 'never-observed');
    expect(latest).toBeNull();
  });

  it('writes markdown with the narrative embedded', async () => {
    const obs = fakeObservation({ narrative: '# Custom\n\nLorem ipsum.' });
    const result = await writeFieldReport(tmp, obs);
    const md = await fs.readFile(result.mdPath, 'utf-8');
    expect(md).toContain('# Custom');
    expect(md).toContain('Lorem ipsum.');
  });
});
