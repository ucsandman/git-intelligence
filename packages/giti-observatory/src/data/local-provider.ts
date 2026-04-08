import type { ObservatorySnapshot, OrganismEventDigest } from '../types/snapshot';

export interface DataProvider {
  fetchSnapshot(): Promise<ObservatorySnapshot>;
  subscribe(onEvent: (event: OrganismEventDigest) => void): () => void;
}

export function createLocalProvider(baseUrl: string): DataProvider {
  return {
    async fetchSnapshot() {
      const res = await fetch(`${baseUrl}/api/snapshot`);
      if (!res.ok) throw new Error(`Snapshot fetch failed: ${res.status}`);
      return res.json() as Promise<ObservatorySnapshot>;
    },

    subscribe(onEvent) {
      const eventSource = new EventSource(`${baseUrl}/api/events`);

      eventSource.addEventListener('file-changed', (e) => {
        try {
          const parsed = JSON.parse((e as MessageEvent).data);
          if (parsed.path?.includes('knowledge-base') && parsed.data?.events) {
            const events = parsed.data.events as OrganismEventDigest[];
            const latest = events[events.length - 1];
            if (latest) onEvent(latest);
          }
        } catch {
          // skip unparseable events
        }
      });

      eventSource.addEventListener('file-added', (e) => {
        try {
          const parsed = JSON.parse((e as MessageEvent).data);
          if (parsed.data) {
            onEvent({
              id: `sse-${Date.now()}`,
              timestamp: new Date().toISOString(),
              cycle: 0,
              type: 'file-added',
              agent: 'observatory',
              summary: `New file: ${parsed.path}`,
            });
          }
        } catch {
          // skip
        }
      });

      return () => eventSource.close();
    },
  };
}
