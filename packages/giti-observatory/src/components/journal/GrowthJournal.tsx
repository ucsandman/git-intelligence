'use client';

import { useState, useMemo } from 'react';
import { useObservatory } from '@/data/provider-context';
import { CycleCard } from './CycleCard';
import { LiveCycleCard } from './LiveCycleCard';
import { FilterChips } from './FilterChips';

interface Props {
  onShowInTerrarium?: (cycle: number) => void;
}

export function GrowthJournal({ onShowInTerrarium }: Props) {
  const { snapshot } = useObservatory();
  const [filters, setFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (filter: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  const filteredHistory = useMemo(() => {
    if (!snapshot) return [];
    let cycles = [...snapshot.history].reverse();

    if (filters.size > 0) {
      cycles = cycles.filter((c) => {
        if (filters.has('milestone') && !c.milestone) return false;
        const outcomeFilters = [...filters].filter((f) => f !== 'milestone');
        if (outcomeFilters.length > 0 && !outcomeFilters.includes(c.outcome))
          return false;
        return true;
      });
    }

    return cycles;
  }, [snapshot, filters]);

  if (!snapshot) {
    return (
      <div className="p-6 text-terrarium-text-muted text-sm">Loading journal...</div>
    );
  }

  return (
    <section className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-terrarium-text">
          Growth Journal
        </h2>
        <FilterChips activeFilters={filters} onToggle={toggleFilter} />
      </div>

      <div className="space-y-3">
        {snapshot.current_cycle && (
          <LiveCycleCard currentCycle={snapshot.current_cycle} />
        )}
        {filteredHistory.map((cycle) => (
          <CycleCard
            key={cycle.cycle}
            cycle={cycle}
            dispatch={snapshot.dispatches.find((d) => d.cycle === cycle.cycle)}
            onShowInTerrarium={onShowInTerrarium}
          />
        ))}
        {filteredHistory.length === 0 && (
          <p className="text-terrarium-text-muted text-sm py-8 text-center">
            No cycles match the current filters.
          </p>
        )}
      </div>
    </section>
  );
}
