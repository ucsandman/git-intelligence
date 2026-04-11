import { loadOrganismConfig } from '../utils.js';
import type { NarratorConfig } from '../types.js';
import { loadFieldTargets } from './target-config.js';
import { runFieldObservation } from './runner.js';
import { narrate } from './narrator.js';
import { writeFieldReport, readLatestReport } from './reporter.js';
import type { FieldObservation } from './types.js';

const DEFAULT_NARRATOR: NarratorConfig = {
  enabled: true,
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 600,
  cache_system_prompt: true,
};

/**
 * Run field observation against every enabled, valid target configured in
 * organism.json. Writes reports under gitiPath/.organism/field-reports/<slug>/.
 * Returns all completed observations. Never throws — individual target
 * failures are captured and logged, but do not halt sibling targets.
 */
export async function observe(
  gitiPath: string,
  cycle: number,
): Promise<FieldObservation[]> {
  const targets = await loadFieldTargets(gitiPath);
  if (targets.length === 0) return [];

  let narratorConfig: NarratorConfig = DEFAULT_NARRATOR;
  try {
    const config = await loadOrganismConfig(gitiPath);
    if (config.narrator) narratorConfig = config.narrator;
  } catch {
    // Use defaults if organism.json can't be reloaded (extremely rare —
    // loadFieldTargets would have already returned [] in that case).
  }

  const observations: FieldObservation[] = [];

  for (const target of targets) {
    try {
      const raw = await runFieldObservation(target);
      const previous = await readLatestReport(gitiPath, target.slug);
      const narrateResult = await narrate(raw, previous, narratorConfig);

      if (narrateResult.error) {
        console.error(
          `[field-observer] narrator fallback for ${target.slug}: ${narrateResult.error}`,
        );
      }

      const observation: FieldObservation = {
        ...raw,
        observedAt: new Date().toISOString(),
        cycle,
        narrative: narrateResult.narrative,
        mood: narrateResult.mood,
      };

      await writeFieldReport(gitiPath, observation);
      observations.push(observation);
    } catch (error) {
      // Individual target failure does not halt the others.
      console.error(
        `[field-observer] ${target.slug} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return observations;
}
