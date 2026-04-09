'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ObservatoryProvider } from '@/data/provider-context';
import { createLocalProvider } from '@/data/local-provider';
import { createRemoteProvider } from '@/data/remote-provider';
import { VitalsStrip } from '@/components/vitals/VitalsStrip';
import { GrowthJournal } from '@/components/journal/GrowthJournal';
import { IntroOverlay } from '@/components/IntroOverlay';

const TerrariumScene = dynamic(
  () =>
    import('@/components/terrarium/TerrariumCanvas').then(
      (m) => m.TerrariumCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 min-h-[50vh] bg-terrarium-surface flex items-center justify-center">
        <span className="text-terrarium-text-muted text-sm font-mono">
          Terrarium waking up...
        </span>
      </div>
    ),
  },
);

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
        <IntroOverlay />
        {/* Layer 1: Vitals Strip */}
        <VitalsStrip />

        {/* Layer 2: Terrarium Canvas */}
        <div className="h-[55vh] w-full">
          <TerrariumScene />
        </div>

        {/* Layer 3: Growth Journal */}
        <GrowthJournal onShowInTerrarium={setTimelineCycle} />
      </main>
    </ObservatoryProvider>
  );
}
