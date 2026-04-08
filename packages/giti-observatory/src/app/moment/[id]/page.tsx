'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ObservatoryProvider, useObservatory } from '@/data/provider-context';
import { createLocalProvider } from '@/data/local-provider';
import { createRemoteProvider } from '@/data/remote-provider';
import { VitalsStrip } from '@/components/vitals/VitalsStrip';
import { CycleCard } from '@/components/journal/CycleCard';

function MomentContent() {
  const params = useParams();
  const { snapshot } = useObservatory();
  const cycleId = Number(params.id);

  if (!snapshot) {
    return <div className="p-6 text-terrarium-text-muted">Loading...</div>;
  }

  const cycle = snapshot.history.find((c) => c.cycle === cycleId);
  const dispatch = snapshot.dispatches.find((d) => d.cycle === cycleId);

  if (!cycle) {
    return (
      <div className="p-6 text-terrarium-text-muted">
        Cycle {cycleId} not found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl text-terrarium-text mb-4">
        Cycle {cycle.cycle}
        {cycle.milestone && (
          <span className="text-terrarium-amber ml-2">— {cycle.milestone}</span>
        )}
      </h1>
      <CycleCard cycle={cycle} dispatch={dispatch} />
    </div>
  );
}

export default function MomentPage() {
  const provider = useMemo(() => {
    if (typeof window === 'undefined') return createLocalProvider('');
    const isPublic = process.env.NEXT_PUBLIC_OBSERVATORY_MODE === 'public';
    if (isPublic) {
      const endpoint = process.env.NEXT_PUBLIC_SNAPSHOT_URL ?? '/api/snapshot';
      return createRemoteProvider(endpoint);
    }
    return createLocalProvider(window.location.origin);
  }, []);

  return (
    <ObservatoryProvider provider={provider}>
      <main className="flex flex-col min-h-screen">
        <VitalsStrip />
        <MomentContent />
      </main>
    </ObservatoryProvider>
  );
}
