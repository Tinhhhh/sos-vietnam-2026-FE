import { useCallback, useEffect, useRef, useState } from 'react';

import { connectStomp } from '@/lib/stomp-client';

import { CALLS_DESTINATION, CALL_SEND_DESTINATION, INCIDENT_DESTINATION, getTracking } from '../api/tracking';
import { normalizeTracking } from '../utils/tracking-model';

/**
 * Live state of the citizen's own incident + the STOMP link used for calls.
 * Starts from the incident saved when the SOS was sent, then GET /tracking, then STOMP events.
 * Every (re)connect reloads, so changes made while the phone was offline are not missed.
 *
 * @param {{ initial: object, token: string, onCallSignal: (signal) => void }} options
 *   initial: raw incident (POST /incidents response or the copy in sessionStorage)
 * @returns {{ incident: object, connection: 'connecting'|'live'|'reconnecting',
 *             sendSignal: (signal) => boolean, setIncident: (inc) => void }}
 */
export function useIncidentTracking({ initial, token, onCallSignal }) {
  const [incident, setIncident] = useState(() => normalizeTracking(initial));
  const [connection, setConnection] = useState('connecting');
  const clientRef = useRef(null);
  const id = incident?.id;

  const onSignal = useRef(onCallSignal);
  useEffect(() => {
    onSignal.current = onCallSignal;
  });

  const reload = useCallback(async () => {
    try {
      const fresh = await getTracking(id, token);
      if (fresh) setIncident(fresh);
    } catch {
      // Endpoint missing / offline: keep what we have, STOMP brings the next change
    }
  }, [id, token]);

  useEffect(() => {
    if (!id) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    const client = connectStomp({
      getHeaders: () => ({ 'X-SOS-Access-Token': token, 'X-SOS-Incident-Id': id }),
      onStatusChange: setConnection,
      onConnect: (c) => {
        reload();
        c.subscribe(INCIDENT_DESTINATION, (frame) => {
          try {
            const inc = normalizeTracking(JSON.parse(frame.body).incident);
            if (inc?.id === id) setIncident(inc);
          } catch {
            // ignore malformed frame
          }
        });
        c.subscribe(CALLS_DESTINATION, (frame) => {
          try {
            const signal = JSON.parse(frame.body);
            if (signal.incident_id === id) onSignal.current(signal);
          } catch {
            // ignore malformed frame
          }
        });
      },
    });
    clientRef.current = client;
    return () => {
      clientRef.current = null;
      client.deactivate();
    };
  }, [id, token, reload]);

  /** @returns {boolean} false when the socket is down (the call screen shows "reconnecting") */
  const sendSignal = useCallback((signal) => {
    const client = clientRef.current;
    if (!client?.connected) return false;
    client.publish({ destination: CALL_SEND_DESTINATION, body: JSON.stringify(signal) });
    return true;
  }, []);

  return { incident, connection, sendSignal, setIncident };
}
