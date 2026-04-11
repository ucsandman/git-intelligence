import type { PulseResult, HotspotsResult, GhostsResult } from '../../types/index.js';

export type { FieldTarget } from '../types.js';

export type ObserverMood = 'curious' | 'attentive' | 'alarmed' | 'dozing';

export interface FieldObservation {
  target: string;              // slug
  targetPath: string;          // absolute path
  observedAt: string;          // ISO timestamp
  cycle: number;               // giti's cycle number
  pulse: PulseResult;
  hotspots: HotspotsResult;
  ghosts: GhostsResult;
  narrative: string;           // markdown
  mood: ObserverMood;
  partial: boolean;            // true if any analyzer timed out or errored
  errors: string[];            // analyzer failures, empty on success
}
