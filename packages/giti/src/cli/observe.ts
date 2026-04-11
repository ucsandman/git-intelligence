import chalk from 'chalk';
import ora from 'ora';
import { observe } from '../agents/field-observer/index.js';
import { readJsonFile, getOrganismPath } from '../agents/utils.js';
import type { FieldObservation } from '../agents/field-observer/types.js';

interface CycleCounterFile {
  count: number;
}

const MOOD_COLORS: Record<FieldObservation['mood'], (s: string) => string> = {
  curious: chalk.cyan,
  attentive: chalk.green,
  alarmed: chalk.red,
  dozing: chalk.gray,
};

export async function executeObserve(options: { path?: string; json?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();
  const spinner = options.json ? null : ora('Running field observation...').start();

  try {
    const counter = await readJsonFile<CycleCounterFile>(
      getOrganismPath(repoPath, 'cycle-counter.json'),
    );
    const cycle = counter?.count ?? 0;

    const observations = await observe(repoPath, cycle);
    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify(observations, null, 2));
      return;
    }

    if (observations.length === 0) {
      console.log(chalk.dim('No field targets configured or reachable.'));
      console.log(
        chalk.dim(
          'Configure targets in organism.json under "field_targets", or check that each target path exists and contains a .git directory.',
        ),
      );
      return;
    }

    for (const obs of observations) {
      const moodColor = MOOD_COLORS[obs.mood];
      console.log('');
      console.log(chalk.bold(`◉ ${obs.target}`) + chalk.dim(`  ${obs.targetPath}`));
      console.log(`  Mood: ${moodColor(obs.mood)}  Cycle: ${obs.cycle}  Observed: ${obs.observedAt}`);
      if (obs.partial) {
        console.log(chalk.yellow(`  ⚠ Partial observation — ${obs.errors.join('; ')}`));
      }
      console.log('');
      console.log(
        obs.narrative
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n'),
      );
      console.log('');
      console.log(
        chalk.dim(
          `  Pulse: ${obs.pulse.weeklyCommits.count} commits this week · ${obs.pulse.branches.active} active branches · ${obs.pulse.testRatio.percentage}% test ratio`,
        ),
      );
      console.log(
        chalk.dim(
          `  Hotspots: ${obs.hotspots.hotspots.length} · Ghosts: ${obs.ghosts.staleBranches.length} stale branches, ${obs.ghosts.deadCode.length} dead-code signals`,
        ),
      );
      console.log(
        chalk.dim(`  Report: .organism/field-reports/${obs.target}/`),
      );
    }
    console.log('');
  } catch (error) {
    spinner?.fail('Field observation failed');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
