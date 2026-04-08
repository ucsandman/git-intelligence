import type { DataProvider } from './local-provider.js';
import type { ObservatorySnapshot, OrganismEventDigest } from '../types/snapshot.js';

export function createRemoteProvider(
  snapshotUrl: string,
  pollIntervalMs: number = 60000,
): DataProvider {
  return {
    async fetchSnapshot() {
      const res = await fetch(snapshotUrl);
      if (!res.ok) throw new Error(`Remote snapshot fetch failed: ${res.status}`);
      return res.json() as Promise<ObservatorySnapshot>;
    },

    subscribe(onEvent) {
      let lastEventCount = 0;
      const interval = setInterval(async () => {
        try {
          const res = await fetch(snapshotUrl);
          if (!res.ok) return;
          const snapshot = (await res.json()) as ObservatorySnapshot;
          const newEvents = snapshot.recent_events.slice(0, snapshot.recent_events.length - lastEventCount);
          lastEventCount = snapshot.recent_events.length;
          for (const event of newEvents) {
            onEvent(event as OrganismEventDigest);
          }
        } catch {
          // silent retry on next interval
        }
      }, pollIntervalMs);

      return () => clearInterval(interval);
    },
  };
}
