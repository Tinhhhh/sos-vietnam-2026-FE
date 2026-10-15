import { useCallback, useEffect, useState } from 'react';

import { getCurrentWeather } from '../api/weather';

const REFRESH_MS = 10 * 60 * 1000;

/** Weather at the officer's unit; refreshes every 10 minutes (legacy behaviour). */
export function useWeather(coords) {
  const [state, setState] = useState({ status: 'loading', weather: null });
  const lat = coords?.lat;
  const lng = coords?.lng;

  const refresh = useCallback(async () => {
    if (lat == null || lng == null) {
      setState({ status: 'unavailable', weather: null });
      return;
    }
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const weather = await getCurrentWeather({ lat, lng });
      setState({ status: weather ? 'ready' : 'unavailable', weather });
    } catch {
      setState({ status: 'unavailable', weather: null });
    }
  }, [lat, lng]);

  useEffect(() => {
    // Fetch on mount / when the unit location changes, then poll.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...state, refresh };
}
