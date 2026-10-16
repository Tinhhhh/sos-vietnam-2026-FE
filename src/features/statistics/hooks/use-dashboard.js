import { useCallback, useEffect, useState } from 'react';

import { getDashboardSummary, getEscalatingIncidents } from '../api/dashboard';

const REFRESH_MS = 60 * 1000;

/**
 * Loads the summary for a range (and the ward "about to escalate" list), refreshing every minute.
 * status: 'loading' | 'ready' | 'unavailable' (backend has no dashboard API yet) | 'error'
 *
 * @param {{ from: string, to: string, province?: string, agency?: string, withEscalating?: boolean }} query
 */
export function useDashboard({ from, to, province, agency, withEscalating }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [escalating, setEscalating] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await getDashboardSummary({ from, to, province, agency });
      setState({ status: 'ready', data, error: null });
    } catch (err) {
      setState((s) => ({
        status: err.status === 404 || err.status === 405 ? 'unavailable' : 'error',
        data: s.data,
        error: err.message,
      }));
    }
    if (withEscalating) {
      getEscalatingIncidents()
        .then(setEscalating)
        .catch(() => setEscalating([]));
    }
  }, [from, to, province, agency, withEscalating]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { ...state, escalating, reload: load };
}
