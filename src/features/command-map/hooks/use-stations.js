import { useCallback, useEffect, useState } from 'react';

import { getAllStations } from '../api/stations';

/** All rescue stations (loaded once; the map and the directory tab share them). */
export function useStations() {
  const [state, setState] = useState({ status: 'loading', stations: [], error: null });

  const load = useCallback(async () => {
    try {
      const stations = await getAllStations();
      setState({ status: 'ready', stations, error: null });
    } catch (error) {
      setState({ status: 'error', stations: [], error });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { ...state, reload: load };
}
