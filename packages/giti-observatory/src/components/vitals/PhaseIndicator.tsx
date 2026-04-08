'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  phase?: string;
  isLive: boolean;
}

export function PhaseIndicator({ phase, isLive }: Props) {
  if (!isLive || !phase) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-terrarium-amber animate-pulse" />
      <AnimatePresence mode="wait">
        <motion.span
          key={phase}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="text-xs text-terrarium-amber font-mono uppercase tracking-wider"
        >
          {phase}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
