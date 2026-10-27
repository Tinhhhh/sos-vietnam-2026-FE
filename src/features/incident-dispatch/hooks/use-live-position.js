import { useEffect, useRef, useState } from 'react';

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
 * @returns {{ position: object|null, simulation: object|null, route: object|null, arrivalCheck: object|null,
 *   polled: boolean }} position = { lat, lng, speedKmh, heading, receivedAt }; simulation = latest polled
 *   plan.simulation (officers only); route = latest polled plan.route (the BE recalculates it when the vehicle
 *   leaves it); arrivalCheck = latest polled distance to the destination; null until the first poll
 */
export function useLivePosition({ incidentId, citizenToken, enabled, initial = null, fetchPlan = null }) {
  const [polled, setPolled] = useState({
    position: null,
    simulation: null,
    route: null,
    arrivalCheck: null,
    done: false,
  });
  // fetchPlan: the field officer's link page reads its plan with the link code instead
  const fetchRef = useRef(fetchPlan);
  useEffect(() => {
    fetchRef.current = fetchPlan;
  });
  const active = enabled && (!!incidentId || !!fetchPlan);

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    const tick = () =>
      (fetchRef.current ? fetchRef.current() : getDispatchPlan(incidentId, { citizenToken }))
        .then((plan) => {
          if (!alive || !plan) return;
          setPolled((p) => ({
            position: plan.lastPosition || p.position,
            simulation: plan.simulation,
            route: plan.route,
            arrivalCheck: plan.arrivalCheck,
            done: true,
          }));
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

  if (!active) return { position: null, simulation: null, route: null, arrivalCheck: null, polled: false };
  // whichever is newer: the point loaded with the plan or the last polled one
  const p = polled.position;
  const position = p && (!initial || p.receivedAt >= initial.receivedAt) ? p : initial || p;
  return {
    position,
    simulation: polled.simulation,
    route: polled.route,
    arrivalCheck: polled.arrivalCheck,
    polled: polled.done,
  };
}
