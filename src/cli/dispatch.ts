import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { getOrganismPath } from '../agents/utils.js';
import type { EvolutionDispatch } from '../content/types.js';

export async function executeDispatch(options: {
  path?: string;
  json?: boolean;
  cycle?: string;
  list?: boolean;
  platform?: string;
}): Promise<void> {
  const repoPath = options.path ?? process.cwd();
  const dispatchDir = getOrganismPath(repoPath, 'content', 'dispatches');

  if (options.list) {
    // List all dispatches
    let entries: string[];
    try { entries = await fs.readdir(dispatchDir); } catch { entries = []; }
    const jsonFiles = entries.filter(e => e.endsWith('.json')).sort();
    if (jsonFiles.length === 0) {
      console.log('No dispatches found.');
      return;
    }
    console.log(chalk.bold(`${jsonFiles.length} dispatch(es):\n`));
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(dispatchDir, file), 'utf-8');
        const dispatch = JSON.parse(content) as EvolutionDispatch;
        const milestone = dispatch.milestone ? ` [${dispatch.milestone}]` : '';
        console.log(`  Cycle #${dispatch.cycle}: ${dispatch.headline}${milestone}`);
      } catch {
        console.log(`  ${file} (unreadable)`);
      }
    }
    return;
  }

  if (options.cycle) {
    // Show dispatch for a specific cycle
    let entries: string[];
    try { entries = await fs.readdir(dispatchDir); } catch { entries = []; }
    const match = entries.find(e => e.startsWith(`cycle-${options.cycle}-`));
    if (!match) {
      console.error(`No dispatch found for cycle ${options.cycle}`);
      process.exit(1);
    }
    const content = await fs.readFile(path.join(dispatchDir, match), 'utf-8');
    const dispatch = JSON.parse(content) as EvolutionDispatch;

    if (options.platform) {
      const key = options.platform as keyof EvolutionDispatch['platform_versions'];
      const formatted = dispatch.platform_versions[key];
      if (!formatted) {
        console.error(`Unknown platform: ${options.platform}. Use: twitter, linkedin, hn, blog`);
        process.exit(1);
      }
      console.log(formatted);
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(dispatch, null, 2));
    } else {
      console.log(chalk.bold(`\n🧬 Evolution Dispatch — Cycle #${dispatch.cycle}`));
      console.log(chalk.dim('─'.repeat(40)));
      console.log(chalk.bold(dispatch.headline));
      console.log(`\n${dispatch.narrative}`);
      if (dispatch.key_moments.length > 0) {
        console.log(chalk.bold('\nKey Moments:'));
        for (const km of dispatch.key_moments) {
          console.log(`  - ${km.moment}: ${km.significance}`);
        }
      }
      if (dispatch.milestone) {
        console.log(chalk.yellow(`\nMilestone: ${dispatch.milestone}`));
      }
      console.log(chalk.dim(`\nStats: ${dispatch.stats.changes_merged} merged, ${dispatch.stats.changes_rejected} rejected, streak: ${dispatch.stats.streak}`));
    }
    return;
  }

  // Default: show most recent dispatch
  let entries: string[];
  try { entries = await fs.readdir(dispatchDir); } catch { entries = []; }
  const jsonFiles = entries.filter(e => e.endsWith('.json')).sort();
  if (jsonFiles.length === 0) {
    console.log('No dispatches found. Run a lifecycle cycle first.');
    return;
  }
  const latest = jsonFiles[jsonFiles.length - 1]!;
  // Re-invoke with the cycle number extracted from filename
  const cycleMatch = latest.match(/cycle-(\d+)/);
  if (cycleMatch) {
    await executeDispatch({ ...options, cycle: cycleMatch[1] });
  }
}
