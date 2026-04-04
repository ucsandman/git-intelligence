import { createGitClient, validateGitRepo, parsePeriod } from '../utils/git.js';
import { getHotspots, getFileCouplings } from '../analyzers/file-analyzer.js';
import { formatHotspots } from '../formatters/terminal.js';
import type { HotspotsResult } from '../types/index.js';
import ora from 'ora';

export async function executeHotspots(options: {
  path?: string;
  json?: boolean;
  since?: string;
  top?: number;
}): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  try {
    await validateGitRepo(repoPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(message);
    process.exit(1);
  }

  const spinner = options.json ? null : ora('Analyzing hotspots...').start();

  const git = createGitClient(repoPath);
  const period = options.since ?? '30d';
  const sinceDate = parsePeriod(period);

  const [hotspots, couplings] = await Promise.all([
    getHotspots(git, sinceDate, options.top ?? 10),
    getFileCouplings(git, sinceDate),
  ]);

  const result: HotspotsResult = {
    period,
    hotspots,
    couplings,
  };

  spinner?.stop();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatHotspots(result));
  }
}
