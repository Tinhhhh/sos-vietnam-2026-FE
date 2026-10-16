import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { connectStomp } from '@/lib/stomp-client';

import { QUEUE_DESTINATION, getIncidentQueue } from '../api/incidents';
import { normalizeIncident } from '../utils/incident-model';

/**
 * Live incident queue of the officer's unit.
 * Loads GET /incidents/queue, then applies STOMP events. Every (re)connect reloads the
 * list, so incidents that arrived while the socket was down are not missed.
 *
 * @param {{ getToken: () => string|null, onNewIncident?: (inc) => void, onEscalated?: (inc) => void }} options
 * @returns {{ incidents: object[], status: 'loading'|'ready'|'unavailable'|'error', error: string|null,
 *             connection: 'connecting'|'live'|'reconnecting', reload: () => void, upsert: (inc) => void }}
 */
export function useIncidentQueue({ getToken, onNewIncident, onEscalated }) {
  const [byId, setById] = useState(() => new Map());
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [connection, setConnection] = useState('connecting');

  // Latest callbacks without re-subscribing the socket when the parent re-renders.
  const callbacks = useRef({ getToken, onNewIncident, onEscalated });
  useEffect(() => {
    callbacks.current = { getToken, onNewIncident, onEscalated };
  });

  const reload = useCallback(async () => {
    try {
      const list = await getIncidentQueue();
      setById(new Map(list.map((inc) => [inc.id, inc])));
      setStatus('ready');
      setError(null);
    } catch (err) {
      // 404/405: the backend has no queue endpoint yet.
      setStatus(err.status === 404 || err.status === 405 ? 'unavailable' : 'error');
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    // Load right away: the queue must show even if the socket cannot connect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    const client = connectStomp({
      getToken: () => callbacks.current.getToken(),
      onStatusChange: setConnection,
      onConnect: (c) => {
        reload();
        c.subscribe(QUEUE_DESTINATION, (frame) => {
          let message;
          try {
            message = JSON.parse(frame.body);
          } catch {
            return;
          }
          const inc = normalizeIncident(message.incident);
          if (!inc) return;
          setById((prev) => {
            const next = new Map(prev);
            if (message.event === 'INCIDENT_REMOVED') next.delete(inc.id);
            else next.set(inc.id, inc);
            return next;
          });
          if (message.event === 'INCIDENT_NEW') callbacks.current.onNewIncident?.(inc);
          if (message.event === 'INCIDENT_ESCALATED') callbacks.current.onEscalated?.(inc);
        });
      },
    });
    return () => {
      client.deactivate();
    };
  }, [reload]);

  // Apply an incident returned by claim / release right away (STOMP brings the same change a moment later).
  const upsert = useCallback((inc) => {
    if (!inc) return;
    setById((prev) => new Map(prev).set(inc.id, inc));
  }, []);

  const incidents = useMemo(
    () => [...byId.values()].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
    [byId],
  );

  return { incidents, status, error, connection, reload, upsert };
}
