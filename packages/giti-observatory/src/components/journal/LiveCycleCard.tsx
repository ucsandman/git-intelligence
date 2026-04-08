'use client';

import { motion } from 'framer-motion';
import type { ObservatorySnapshot } from '@/types/snapshot';

interface Props {
  currentCycle: NonNullable<ObservatorySnapshot['current_cycle']>;
}

const phaseLabels: Record<string, string> = {
  sense: 'Sensing...',
  plan: 'Planning...',
  grow: 'Growing...',
  build: 'Building...',
  defend: 'Defending...',
  commit: 'Committing...',
  reflect: 'Reflecting...',
};

export function LiveCycleCard({ currentCycle }: Props) {
  return (
    <motion.div
      className="border-2 border-terrarium-amber/40 rounded-organic bg-terrarium-soil/70 p-4"
      animate={{
        borderColor: [
          'rgba(212, 160, 74, 0.4)',
          'rgba(212, 160, 74, 0.2)',
          'rgba(212, 160, 74, 0.4)',
        ],
      }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-terrarium-amber animate-pulse" />
        <span className="text-sm font-mono text-terrarium-amber">
          Cycle {currentCycle.number} — Live
        </span>
      </div>
      <div className="text-lg font-display text-terrarium-text mb-2">
        {phaseLabels[currentCycle.phase] ?? currentCycle.phase}
      </div>
      {currentCycle.events.length > 0 && (
        <ul className="space-y-1">
          {currentCycle.events.slice(0, 5).map((event) => (
            <li
              key={event.id}
              className="text-xs text-terrarium-text/60 font-mono"
            >
              [{event.agent}] {event.summary}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
