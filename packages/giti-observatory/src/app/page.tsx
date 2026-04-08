'use client';

import { useMemo, useState } from 'react';
import { ObservatoryProvider } from '@/data/provider-context.js';
import { createLocalProvider } from '@/data/local-provider.js';
import { createRemoteProvider } from '@/data/remote-provider.js';
import { VitalsStrip } from '@/components/vitals/VitalsStrip.js';
import { GrowthJournal } from '@/components/journal/GrowthJournal.js';

export default function ObservatoryPage() {
  const [_timelineCycle, setTimelineCycle] = useState<number | null>(null);

  const provider = useMemo(() => {
    if (typeof window === 'undefined') return createLocalProvider('');
    const isPublic = process.env.NEXT_PUBLIC_OBSERVATORY_MODE === 'public';
    if (isPublic) {
      const endpoint =
        process.env.NEXT_PUBLIC_SNAPSHOT_URL ?? '/api/snapshot';
      return createRemoteProvider(endpoint);
    }
    return createLocalProvider(window.location.origin);
  }, []);

  return (
    <ObservatoryProvider provider={provider}>
      <main className="flex flex-col min-h-screen">
        {/* Layer 1: Vitals Strip */}
        <VitalsStrip />

        {/* Layer 2: Terrarium Canvas (placeholder — Phase 3) */}
        <div className="flex-1 min-h-[50vh] bg-terrarium-surface flex items-center justify-center border-b border-terrarium-soil-light/20">
          <span className="text-terrarium-text-muted text-sm font-mono">
            Terrarium loading...
          </span>
        </div>

        {/* Layer 3: Growth Journal */}
        <GrowthJournal onShowInTerrarium={setTimelineCycle} />
      </main>
    </ObservatoryProvider>
  );
}
