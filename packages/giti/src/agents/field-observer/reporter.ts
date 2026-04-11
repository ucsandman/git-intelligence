import fs from 'node:fs/promises';
import path from 'node:path';
import { getOrganismPath, ensureOrganismDir } from '../utils.js';
import type { FieldObservation } from './types.js';

const REPORTS_SUBDIR = 'field-reports';

export interface WriteResult {
  mdPath: string;
  jsonPath: string;
}

/**
 * Write a field observation atomically to .organism/field-reports/<slug>/.
 * Produces a markdown + JSON pair with matching basenames, plus updates
 * latest.json pointing at the freshest observation.
 */
export async function writeFieldReport(
  repoPath: string,
  observation: FieldObservation,
): Promise<WriteResult> {
  const slugDir = await ensureOrganismDir(repoPath, REPORTS_SUBDIR, observation.target);
  const safeStamp = observation.observedAt.replace(/:/g, '-');

  const mdPath = path.join(slugDir, `${safeStamp}.md`);
  const jsonPath = path.join(slugDir, `${safeStamp}.json`);
  const latestPath = path.join(slugDir, 'latest.json');

  const md = formatMarkdown(observation);
  const json = JSON.stringify(observation, null, 2);

  // Stage all three files to .tmp siblings first; if any write fails,
  // none of the renames run and the slug dir is untouched.
  const stamp = `${process.pid}-${Date.now()}`;
  const mdTmp = `${mdPath}.tmp-${stamp}`;
  const jsonTmp = `${jsonPath}.tmp-${stamp}`;
  const latestTmp = `${latestPath}.tmp-${stamp}`;

  await fs.writeFile(mdTmp, md, 'utf-8');
  await fs.writeFile(jsonTmp, json, 'utf-8');
  await fs.writeFile(latestTmp, json, 'utf-8');

  await fs.rename(mdTmp, mdPath);
  await fs.rename(jsonTmp, jsonPath);
  await fs.rename(latestTmp, latestPath);

  return { mdPath, jsonPath };
}

/**
 * Read the most recent observation for a target, or null if none exists.
 */
export async function readLatestReport(
  repoPath: string,
  slug: string,
): Promise<FieldObservation | null> {
  const latestPath = getOrganismPath(repoPath, REPORTS_SUBDIR, slug, 'latest.json');
  try {
    const raw = await fs.readFile(latestPath, 'utf-8');
    return JSON.parse(raw) as FieldObservation;
  } catch {
    return null;
  }
}

function formatMarkdown(obs: FieldObservation): string {
  const lines: string[] = [];
  lines.push(`# Field Report: ${obs.target}`);
  lines.push('');
  lines.push(`**Observed:** ${obs.observedAt}`);
  lines.push(`**Cycle:** ${obs.cycle}`);
  lines.push(`**Mood:** ${obs.mood}`);
  if (obs.partial) {
    lines.push(`**⚠ Partial observation.** Errors: ${obs.errors.join('; ')}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(obs.narrative);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Raw signals');
  lines.push('');
  lines.push(`- Pulse: ${obs.pulse.weeklyCommits.count} commits this week by ${obs.pulse.weeklyCommits.authorCount} author(s); ${obs.pulse.branches.active} active branches; test ratio ${obs.pulse.testRatio.percentage}%`);
  lines.push(`- Hotspots: ${obs.hotspots.hotspots.length} file(s), ${obs.hotspots.couplings.length} coupling(s) over ${obs.hotspots.period}`);
  lines.push(`- Ghosts: ${obs.ghosts.staleBranches.length} stale branch(es), ${obs.ghosts.deadCode.length} dead-code signal(s)`);
  return lines.join('\n');
}
