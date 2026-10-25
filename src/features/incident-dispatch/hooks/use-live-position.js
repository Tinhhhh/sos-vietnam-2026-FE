import { useEffect, useState } from 'react';

import { getDispatchPlan } from '../api/dispatch-api';

/** The app on the field officer's phone sends a point every 5 s; asking at the same pace is enough. */
const POLL_MS = 5000;

/**
 * Live GPS position of the field officer while the dispatch is on the way (EN_ROUTE): re-reads
 * GET /dispatch-plan every 5 s and keeps its `last_position` (the BE holds the latest Traccar point).
 * Polling instead of a STOMP channel: it recovers by itself after a network drop and needs no socket.
 *
 * @param {{ incidentId?: string, citizenToken?: string, enabled: boolean, initial?: object|null }} options
 *   initial = plan.lastPosition already loaded with the plan
 * @returns {object|null} { lat, lng, speedKmh, heading, receivedAt } or null
 */
export function useLivePosition({ incidentId, citizenToken, enabled, initial = null }) {
  const [polled, setPolled] = useState(null);
  const active = enabled && !!incidentId;

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    const tick = () =>
      getDispatchPlan(incidentId, { citizenToken })
        .then((plan) => {
          if (alive && plan?.lastPosition) setPolled(plan.lastPosition);
        })
        .catch(() => {
          // offline / server busy: the view shows "Đang kết nối lại…" once the point gets old
        });
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [active, incidentId, citizenToken]);

  if (!active) return null;
  // whichever is newer: the point loaded with the plan or the last polled one
  if (polled && (!initial || polled.receivedAt >= initial.receivedAt)) return polled;
  return initial || polled;
}
