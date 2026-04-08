import type { ObservatorySnapshot } from '../types/snapshot';
import type {
  SceneState,
  CreatureMood,
  WeatherType,
  TimeOfDay,
  FloraItem,
  FloraType,
  SporeItem,
  FossilItem,
} from '../types/scene';

const FLORA_CAP = 200;

function deriveCreatureMood(snapshot: ObservatorySnapshot): CreatureMood {
  const { current_state } = snapshot.organism;
  if (current_state === 'killed') return 'dormant';
  if (current_state === 'cooldown') return 'resting';
  if (current_state === 'active') {
    // Check if last event was a regression
    const lastEvent = snapshot.current_cycle?.events[0];
    if (lastEvent?.type === 'regression-detected') return 'recoiling';
    if (lastEvent?.type === 'change-merged') return 'excited';
    return 'alert';
  }
  return 'content';
}

function deriveWeather(snapshot: ObservatorySnapshot): WeatherType {
  const recent = snapshot.history.slice(-5);
  const regressions = recent.filter((c) => c.outcome === 'regression').length;
  if (regressions >= 2) return 'fog';
  if (regressions >= 1) return 'storm';
  const productive = recent.filter((c) => c.outcome === 'productive').length;
  if (productive === 0 && recent.length > 0) return 'overcast';
  return 'sunny';
}

function deriveTimeOfDay(snapshot: ObservatorySnapshot): TimeOfDay {
  if (snapshot.organism.current_state === 'active') return 'day';
  if (snapshot.organism.current_state === 'killed') return 'night';
  // Check how recently the last cycle ran
  const lastCycle = snapshot.history[snapshot.history.length - 1];
  if (!lastCycle) return 'dawn';
  const hoursSince =
    (Date.now() - new Date(lastCycle.timestamp).getTime()) / 3600000;
  if (hoursSince < 1) return 'day';
  if (hoursSince < 6) return 'dusk';
  return 'night';
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function deriveFlora(snapshot: ObservatorySnapshot): FloraItem[] {
  const flora: FloraItem[] = [];
  const rand = seededRandom(42);

  for (const cycle of snapshot.history) {
    if (cycle.changes_merged <= 0) continue;
    for (let i = 0; i < cycle.changes_merged; i++) {
      const types: FloraType[] = ['shrub', 'flower', 'vine'];
      const type = types[Math.floor(rand() * types.length)]!;
      const angle = rand() * Math.PI * 2;
      const radius = 1 + rand() * 4;
      flora.push({
        id: `flora-${cycle.cycle}-${i}`,
        cycle: cycle.cycle,
        type,
        position: [
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius,
        ],
        age: snapshot.organism.total_cycles - cycle.cycle,
        fossilized: false,
      });
    }
  }

  // Cap at FLORA_CAP — oldest become fossilized
  if (flora.length > FLORA_CAP) {
    const sorted = flora.sort((a, b) => a.cycle - b.cycle);
    const excess = sorted.length - FLORA_CAP;
    for (let i = 0; i < excess; i++) {
      sorted[i]!.fossilized = true;
    }
  }

  return flora;
}

function deriveSpores(snapshot: ObservatorySnapshot): SporeItem[] {
  const rand = seededRandom(99);
  return snapshot.recent_events
    .filter((e) => e.type === 'growth-proposed')
    .map((e) => {
      const angle = rand() * Math.PI * 2;
      const radius = 2 + rand() * 3;
      const approved = snapshot.recent_events.some(
        (ae) =>
          ae.type === 'growth-approved' && ae.cycle === e.cycle,
      );
      const rejected = snapshot.recent_events.some(
        (re) =>
          re.type === 'growth-rejected' && re.cycle === e.cycle,
      );
      return {
        id: `spore-${e.id}`,
        cycle: e.cycle,
        status: approved
          ? ('rooted' as const)
          : rejected
            ? ('fading' as const)
            : ('drifting' as const),
        position: [
          Math.cos(angle) * radius,
          1 + rand() * 2,
          Math.sin(angle) * radius,
        ] as [number, number, number],
      };
    });
}

function deriveFossils(snapshot: ObservatorySnapshot): FossilItem[] {
  const rand = seededRandom(77);
  return snapshot.milestones.map((milestone, i) => {
    const angle = (i / Math.max(snapshot.milestones.length, 1)) * Math.PI * 2;
    const radius = 3 + rand() * 2;
    const cycle = snapshot.dispatches.find(
      (d) => d.milestone === milestone,
    )?.cycle ?? 0;
    return {
      id: `fossil-${milestone}`,
      milestone,
      cycle,
      position: [
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ],
    };
  });
}

function derivePersonality(snapshot: ObservatorySnapshot): SceneState['creature']['personality'] {
  const { rejection_reasons, successful_change_types, failed_change_types } =
    snapshot.knowledge;

  const totalRejections = Object.values(rejection_reasons).reduce(
    (s, v) => s + v,
    0,
  );
  const totalSuccesses = Object.values(successful_change_types).reduce(
    (s, v) => s + v,
    0,
  );
  const totalFailures = Object.values(failed_change_types).reduce(
    (s, v) => s + v,
    0,
  );
  const totalAttempts = totalSuccesses + totalFailures;

  const caution =
    totalAttempts > 0
      ? Math.min(1, (totalRejections + totalFailures) / totalAttempts)
      : 0.3;
  const eagerness =
    totalAttempts > 0 ? Math.min(1, totalSuccesses / totalAttempts) : 0.5;
  const resilience =
    snapshot.history.filter((c) => c.outcome === 'regression').length > 0
      ? Math.min(
          1,
          snapshot.history.filter(
            (c) =>
              c.outcome === 'productive' &&
              snapshot.history.some(
                (r) =>
                  r.outcome === 'regression' && r.cycle < c.cycle,
              ),
          ).length * 0.25,
        )
      : 0.3;

  return { caution, eagerness, resilience };
}

function deriveActiveOrgans(phase: string): string[] {
  const phaseToOrgans: Record<string, string[]> = {
    sense: ['sensory-cortex'],
    plan: ['prefrontal-cortex'],
    grow: ['growth-hormone'],
    build: ['motor-cortex'],
    defend: ['immune-system'],
    commit: ['motor-cortex'],
    reflect: ['memory', 'sensory-cortex'],
  };
  return phaseToOrgans[phase] ?? [];
}

export function mapSnapshotToScene(
  snapshot: ObservatorySnapshot,
): SceneState {
  const maturity = Math.min(1, snapshot.organism.total_cycles / 50);

  return {
    creature: {
      mood: deriveCreatureMood(snapshot),
      size: 0.5 + maturity * 1.5,
      maturity,
      bioluminescence: snapshot.vitals.fitness_score / 100,
      personality: derivePersonality(snapshot),
      activeOrgans: snapshot.current_cycle
        ? deriveActiveOrgans(snapshot.current_cycle.phase)
        : [],
    },
    environment: {
      groundLushness: snapshot.vitals.test_coverage / 100,
      flora: deriveFlora(snapshot),
      spores: deriveSpores(snapshot),
      fossils: deriveFossils(snapshot),
      weather: deriveWeather(snapshot),
      timeOfDay: deriveTimeOfDay(snapshot),
      energyPoolLevel: 1 - snapshot.vitals.regression_rate / 100,
    },
    activity: {
      isLive: snapshot.organism.current_state === 'active',
      currentPhase: snapshot.current_cycle?.phase,
      activeAgent: snapshot.current_cycle?.events[0]?.agent,
    },
  };
}
