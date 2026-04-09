'use client';

import { useObservatory } from '@/data/provider-context';
import { StateIndicator } from './StateIndicator';
import { SparkChart } from './SparkChart';
import { PhaseIndicator } from './PhaseIndicator';
import { friendlyLabel } from '@/lib/format';

export function VitalsStrip() {
  const { snapshot, scene } = useObservatory();

  if (!snapshot || !scene) {
    return (
      <header className="h-12 bg-terrarium-soil/60 backdrop-blur-md border-b border-terrarium-soil-light/20 flex items-center px-4">
        <span className="text-terrarium-text-muted text-sm">Loading...</span>
      </header>
    );
  }

  const fitnessColor =
    snapshot.vitals.fitness_score >= 80
      ? 'text-terrarium-moss-light'
      : snapshot.vitals.fitness_score >= 50
        ? 'text-terrarium-amber'
        : 'text-red-400';

  // Build spark data from history (last 20 cycles)
  const recentHistory = snapshot.history.slice(-20);
  const coverageSpark = recentHistory.map((c) =>
    c.changes_merged > 0 ? snapshot.vitals.test_coverage : snapshot.vitals.test_coverage - 1,
  );
  const velocitySpark = recentHistory.map((c) => c.changes_merged);

  return (
    <header className="h-12 bg-terrarium-soil/60 backdrop-blur-md border-b border-terrarium-soil-light/20 flex items-center justify-between px-4 gap-6 relative z-10">
      <div className="flex items-center gap-4">
        <StateIndicator
          state={snapshot.organism.current_state}
          organismName={snapshot.organism.name}
        />
        <div className={`font-mono text-lg font-bold ${fitnessColor}`}>
          {snapshot.vitals.fitness_score}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SparkChart
          values={coverageSpark}
          label={friendlyLabel('test_coverage')}
        />
        <SparkChart
          values={velocitySpark}
          label={friendlyLabel('commit_velocity_7d')}
          color="stroke-terrarium-amber"
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-terrarium-text-muted font-mono">
          Cycle {snapshot.organism.total_cycles}
        </span>
        <PhaseIndicator
          phase={scene.activity.currentPhase}
          isLive={scene.activity.isLive}
        />
      </div>
    </header>
  );
}
