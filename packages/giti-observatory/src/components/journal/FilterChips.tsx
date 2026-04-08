'use client';

import type { CycleOutcome } from '@/types/snapshot.js';

interface Props {
  activeFilters: Set<string>;
  onToggle: (filter: string) => void;
}

const OUTCOME_FILTERS: Array<{ value: CycleOutcome; label: string }> = [
  { value: 'productive', label: 'Productive' },
  { value: 'stable', label: 'Stable' },
  { value: 'regression', label: 'Regression' },
  { value: 'no-changes', label: 'No Changes' },
];

export function FilterChips({ activeFilters, onToggle }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onToggle('milestone')}
        className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
          activeFilters.has('milestone')
            ? 'bg-terrarium-amber/20 text-terrarium-amber border border-terrarium-amber/30'
            : 'bg-terrarium-soil-light/50 text-terrarium-text-muted border border-transparent hover:border-terrarium-soil-light'
        }`}
      >
        Milestones
      </button>
      {OUTCOME_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onToggle(f.value)}
          className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
            activeFilters.has(f.value)
              ? 'bg-terrarium-cyan/15 text-terrarium-cyan border border-terrarium-cyan/30'
              : 'bg-terrarium-soil-light/50 text-terrarium-text-muted border border-transparent hover:border-terrarium-soil-light'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
