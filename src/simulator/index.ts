import type { SimulationConfig, SimulationResult, ScenarioResult, RepoType } from './types.js';
import { generateRepo } from './repo-generator.js';
import { scenarios, selectScenario } from './scenarios.js';
import { getUserConfig, setUserConfig } from '../telemetry/store.js';

const DEFAULT_REPO_TYPES: RepoType[] = ['small', 'medium', 'large', 'fresh'];

export async function runSimulation(
  _repoPath: string,
  config: SimulationConfig = { scenario_count: 20, repo_types: DEFAULT_REPO_TYPES },
): Promise<SimulationResult> {
  const startTime = Date.now();

  // Temporarily enable telemetry for simulation
  const origConfig = await getUserConfig();
  await setUserConfig({ enabled: true, first_prompt_shown: true });

  const results: ScenarioResult[] = [];
  let totalEvents = 0;

  try {
    for (const repoType of config.repo_types) {
      const { repoPath: tempRepo, cleanup } = await generateRepo(repoType);

      const scenariosPerRepo = Math.ceil(config.scenario_count / config.repo_types.length);

      for (let i = 0; i < scenariosPerRepo; i++) {
        const scenarioName = selectScenario();
        const scenarioFn = scenarios[scenarioName];
        if (!scenarioFn) continue;

        const scenarioStart = Date.now();
        try {
          const { commands, events } = await scenarioFn(tempRepo);
          totalEvents += events;
          results.push({
            repo_type: repoType,
            scenario: scenarioName,
            commands_run: commands,
            events_generated: events,
            duration_ms: Date.now() - scenarioStart,
          });
        } catch {
          // Individual scenario failures are non-critical
        }
      }

      await cleanup();
    }
  } finally {
    // Restore original telemetry config
    await setUserConfig(origConfig);
  }

  return {
    timestamp: new Date().toISOString(),
    total_scenarios: results.length,
    total_events: totalEvents,
    results,
    duration_ms: Date.now() - startTime,
  };
}
