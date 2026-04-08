'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { ObservatorySnapshot, OrganismEventDigest } from '../types/snapshot';
import type { SceneState } from '../types/scene';
import type { DataProvider } from './local-provider';
import { mapSnapshotToScene } from '../lib/scene-mapper';

interface ObservatoryState {
  snapshot: ObservatorySnapshot | null;
  scene: SceneState | null;
  loading: boolean;
  error: string | null;
  liveEvents: OrganismEventDigest[];
  refresh: () => Promise<void>;
}

const ObservatoryContext = createContext<ObservatoryState>({
  snapshot: null,
  scene: null,
  loading: true,
  error: null,
  liveEvents: [],
  refresh: async () => {},
});

export function useObservatory(): ObservatoryState {
  return useContext(ObservatoryContext);
}

interface Props {
  provider: DataProvider;
  children: ReactNode;
}

export function ObservatoryProvider({ provider, children }: Props) {
  const [snapshot, setSnapshot] = useState<ObservatorySnapshot | null>(null);
  const [scene, setScene] = useState<SceneState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<OrganismEventDigest[]>([]);

  const refresh = useCallback(async () => {
    try {
      const snap = await provider.fetchSnapshot();
      setSnapshot(snap);
      setScene(mapSnapshotToScene(snap));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch snapshot');
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = provider.subscribe((event) => {
      setLiveEvents((prev) => [event, ...prev].slice(0, 50));
      // Refresh snapshot when we receive events
      refresh();
    });
    return unsubscribe;
  }, [provider, refresh]);

  return (
    <ObservatoryContext.Provider
      value={{ snapshot, scene, loading, error, liveEvents, refresh }}
    >
      {children}
    </ObservatoryContext.Provider>
  );
}
