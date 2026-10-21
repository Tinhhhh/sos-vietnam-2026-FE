import { useCallback, useEffect, useRef, useState } from 'react';

import { getAllStations } from '../api/stations';

const RETRY_MS = 10_000; // backend restarting (devtools) / offline: try again until it answers

/**
 * All rescue stations (loaded once; the map, the directory tab and the dispatch window share them).
 * A failed load retries every 10 s, so a page opened while the backend was down still gets them.
 */
export function useStations() {
  const [state, setState] = useState({ status: 'loading', stations: [], error: null });
  const retryRef = useRef(null);
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    clearTimeout(retryRef.current);
    try {
      const stations = await getAllStations();
      if (aliveRef.current) setState({ status: 'ready', stations, error: null });
    } catch (error) {
      if (!aliveRef.current) return;
      setState((s) => ({ status: s.stations.length ? 'ready' : 'error', stations: s.stations, error }));
      retryRef.current = setTimeout(() => load(), RETRY_MS);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
      clearTimeout(retryRef.current);
    };
  }, [load]);

  return { ...state, reload: load };
}
