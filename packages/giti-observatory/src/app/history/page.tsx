'use client';

import { useMemo } from 'react';
import { ObservatoryProvider } from '@/data/provider-context.js';
import { createLocalProvider } from '@/data/local-provider.js';
import { createRemoteProvider } from '@/data/remote-provider.js';
import { VitalsStrip } from '@/components/vitals/VitalsStrip.js';
import { GrowthJournal } from '@/components/journal/GrowthJournal.js';

export default function HistoryPage() {
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
        <div className="flex-1">
          <GrowthJournal />
        </div>
      </main>
    </ObservatoryProvider>
  );
}
