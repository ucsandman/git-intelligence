import { recordCommandTelemetry } from '../telemetry/collector.js';
import { runCommand } from '../agents/utils.js';

export type ScenarioFn = (repoPath: string) => Promise<{ commands: string[]; events: number }>;

export const scenarios: Record<string, ScenarioFn> = {
  quickCheck: async (repoPath) => {
    const start = Date.now();
    runCommand('node', ['dist/index.js', 'pulse', '--path', repoPath], process.cwd());
    await recordCommandTelemetry(repoPath, 'pulse', [], Date.now() - start, 0);
    return { commands: ['pulse'], events: 1 };
  },

  deepAnalysis: async (repoPath) => {
    const commands = ['pulse', 'hotspots', 'ghosts'];
    let events = 0;
    for (const cmd of commands) {
      const start = Date.now();
      runCommand('node', ['dist/index.js', cmd, '--path', repoPath, '--json'], process.cwd());
      await recordCommandTelemetry(repoPath, cmd, ['--json'], Date.now() - start, 0);
      events++;
    }
    return { commands, events };
  },

  hotspotFocus: async (repoPath) => {
    const periods = ['7d', '30d', '90d'];
    let events = 0;
    for (const since of periods) {
      const start = Date.now();
      runCommand('node', ['dist/index.js', 'hotspots', '--since', since, '--path', repoPath], process.cwd());
      await recordCommandTelemetry(repoPath, 'hotspots', [`--since=${since}`], Date.now() - start, 0);
      events++;
    }
    return { commands: periods.map(() => 'hotspots'), events };
  },

  cleanupMode: async (repoPath) => {
    const start = Date.now();
    runCommand('node', ['dist/index.js', 'ghosts', '--path', repoPath], process.cwd());
    await recordCommandTelemetry(repoPath, 'ghosts', [], Date.now() - start, 0);
    return { commands: ['ghosts'], events: 1 };
  },

  jsonPipeline: async (repoPath) => {
    const commands = ['pulse', 'hotspots'];
    let events = 0;
    for (const cmd of commands) {
      const start = Date.now();
      runCommand('node', ['dist/index.js', cmd, '--json', '--path', repoPath], process.cwd());
      await recordCommandTelemetry(repoPath, cmd, ['--json'], Date.now() - start, 0);
      events++;
    }
    return { commands, events };
  },

  errorPath: async (repoPath) => {
    const start = Date.now();
    const result = runCommand('node', ['dist/index.js', 'pulse', '--path', '/nonexistent'], process.cwd());
    await recordCommandTelemetry(repoPath, 'pulse', [], Date.now() - start, result.status, 'Error');
    return { commands: ['pulse'], events: 1 };
  },
};

export function selectScenario(): string {
  const rand = Math.random();
  if (rand < 0.35) return 'quickCheck';
  if (rand < 0.55) return 'deepAnalysis';
  if (rand < 0.70) return 'hotspotFocus';
  if (rand < 0.80) return 'cleanupMode';
  if (rand < 0.90) return 'jsonPipeline';
  if (rand < 0.95) return 'errorPath';
  return 'quickCheck';
}
