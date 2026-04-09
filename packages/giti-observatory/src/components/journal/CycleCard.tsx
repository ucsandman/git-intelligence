'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CycleDigest, DispatchDigest } from '@/types/snapshot';
import { friendlyOutcome, relativeTime } from '@/lib/format';
import { MilestoneBadge } from './MilestoneBadge';

const outcomeColors: Record<string, string> = {
  productive: 'bg-terrarium-moss/20 text-terrarium-moss-light',
  stable: 'bg-terrarium-soil-light/30 text-terrarium-text-muted',
  'no-changes': 'bg-terrarium-soil-light/20 text-terrarium-text-muted',
  regression: 'bg-red-500/15 text-red-400',
  'human-declined': 'bg-terrarium-amber/15 text-terrarium-amber',
  aborted: 'bg-terrarium-soil-light/20 text-terrarium-text-muted',
};

interface Props {
  cycle: CycleDigest;
  dispatch?: DispatchDigest;
  onShowInTerrarium?: (cycle: number) => void;
}

export function CycleCard({ cycle, dispatch, onShowInTerrarium }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border border-terrarium-soil-light/30 rounded-organic bg-terrarium-soil/50 hover:border-terrarium-soil-light/60 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Compact view */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-terrarium-text-muted">
              Cycle {cycle.cycle}
            </span>
            <span className="text-xs text-terrarium-text-muted">
              {relativeTime(cycle.timestamp)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${outcomeColors[cycle.outcome] ?? ''}`}
            >
              {friendlyOutcome(cycle.outcome)}
            </span>
            {cycle.milestone && <MilestoneBadge milestone={cycle.milestone} />}
          </div>
          {dispatch && (
            <p className="text-sm text-terrarium-text/80 line-clamp-1">
              {dispatch.headline}
            </p>
          )}
        </div>
        <div className="flex gap-3 text-xs text-terrarium-text-muted font-mono shrink-0">
          <span>{cycle.changes_merged} merged</span>
          <span>{cycle.changes_rejected} rejected</span>
        </div>
      </div>

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (dispatch || cycle.events) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-terrarium-soil-light/20 pt-3">
              {dispatch && (
                <>
                  <p className="text-sm text-terrarium-text/70 leading-relaxed mb-3">
                    {dispatch.narrative}
                  </p>
                  {dispatch.key_moments.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-mono text-terrarium-text-muted mb-1">
                        Key Moments
                      </h4>
                      <ul className="space-y-1">
                        {dispatch.key_moments.map((m, i) => (
                          <li
                            key={i}
                            className="text-xs text-terrarium-text/60 pl-3 border-l border-terrarium-cyan/30"
                          >
                            <span className="text-terrarium-cyan/80">
                              {m.moment}
                            </span>
                            {' — '}
                            {m.significance}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {/* Agent activity events */}
              {cycle.events && cycle.events.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-mono text-terrarium-text-muted mb-2">
                    Agent Activity
                  </h4>
                  <ul className="space-y-1.5">
                    {cycle.events.map((ev, i) => {
                      const agentColor: Record<string, string> = {
                        'sensory-cortex': 'text-terrarium-cyan/80',
                        'prefrontal-cortex': 'text-yellow-400/80',
                        'motor-cortex': 'text-terrarium-moss-light',
                        'immune-system': 'text-red-400/80',
                        'memory': 'text-purple-400/80',
                        'growth-hormone': 'text-terrarium-amber',
                      };
                      const color = agentColor[ev.agent] ?? 'text-terrarium-text-muted';
                      const icon: Record<string, string> = {
                        'plan-created': '📋',
                        'implementation-complete': '🔨',
                        'implementation-failed': '❌',
                        'change-approved': '✅',
                        'change-rejected': '🛡️',
                        'change-merged': '🌱',
                        'regression-detected': '⚠️',
                        'growth-proposed': '🌿',
                      };
                      return (
                        <li key={i} className="text-xs flex items-start gap-2">
                          <span>{icon[ev.type] ?? '•'}</span>
                          <span className={`font-mono ${color}`}>{ev.agent}</span>
                          <span className="text-terrarium-text/60">{ev.summary}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {!dispatch && (!cycle.events || cycle.events.length === 0) && (
                <p className="text-xs text-terrarium-text-muted">No detailed activity recorded for this cycle.</p>
              )}
              {onShowInTerrarium && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowInTerrarium(cycle.cycle);
                  }}
                  className="text-xs text-terrarium-cyan hover:text-terrarium-cyan/80 font-mono"
                >
                  Show in terrarium
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
