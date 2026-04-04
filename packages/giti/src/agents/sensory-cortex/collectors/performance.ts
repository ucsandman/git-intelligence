import type { StateReport } from '../types.js';
import { runCommand } from '../../utils.js';

const COMMANDS = ['pulse', 'hotspots', 'ghosts'] as const;
const RUNS_PER_COMMAND = 3;

export async function collectPerformance(
  repoPath: string,
): Promise<StateReport['performance']> {
  const timings: Record<string, number[]> = {
    pulse: [],
    hotspots: [],
    ghosts: [],
  };

  for (const cmd of COMMANDS) {
    for (let i = 0; i < RUNS_PER_COMMAND; i++) {
      const start = Date.now();
      runCommand('node', ['dist/index.js', cmd, '--json'], repoPath);
      const elapsed = Date.now() - start;
      timings[cmd]!.push(elapsed);
    }
  }

  return {
    pulse_execution_ms: median(timings['pulse']!),
    hotspots_execution_ms: median(timings['hotspots']!),
    ghosts_execution_ms: median(timings['ghosts']!),
    benchmarked_against: repoPath,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
