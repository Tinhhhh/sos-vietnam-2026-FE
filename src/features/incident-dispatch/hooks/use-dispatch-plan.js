import { useEffect, useState } from 'react';

import { getDispatchPlan } from '../api/dispatch-api';

/**
 * Current dispatch plan of an incident, re-read whenever `refreshKey` changes (the citizen screen passes
 * the live incident object, which is replaced on every STOMP push).
 *
 * @param {{ incidentId: string, citizenToken?: string, enabled?: boolean, refreshKey?: unknown }} options
 * @returns {{ plan: object|null, status: 'idle'|'loading'|'ready'|'error' }}
 */
export function useDispatchPlan({ incidentId, citizenToken, enabled = true, refreshKey }) {
  const [state, setState] = useState({ key: null, plan: null, failed: false });
  const key = enabled && incidentId ? incidentId : null;

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    getDispatchPlan(key, { citizenToken })
      .then((plan) => alive && setState({ key, plan, failed: false }))
      .catch(() => alive && setState((s) => ({ ...s, key, failed: true })));
    return () => {
      alive = false;
    };
  }, [key, citizenToken, refreshKey]);

  if (!key) return { plan: null, status: 'idle' };
  if (state.key !== key) return { plan: null, status: 'loading' };
  return { plan: state.plan, status: state.failed && !state.plan ? 'error' : 'ready' };
}
