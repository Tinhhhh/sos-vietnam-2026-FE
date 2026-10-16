import { useCallback, useEffect, useRef, useState } from 'react';

import { useCall } from '@/hooks/use-call';
import { VIDEO_PROFILES } from '@/lib/webrtc/call-session';
import { getIceServers } from '@/lib/webrtc/ice-servers';
import { connectStomp } from '@/lib/stomp-client';

import { CALLS_DESTINATION, CALL_SEND_DESTINATION } from '../api/calls';

/**
 * The officer's phone line: one STOMP connection for call signals + one call at a time.
 * The officer's webcam is optional (no camera = voice only, the citizen sees an avatar).
 *
 * @param {{ getToken: () => string | null }} options
 * @returns {ReturnType<typeof useCall> & {
 *   connection: 'connecting' | 'live' | 'reconnecting',
 *   callCitizen: (incident: { id: string, citizenName?: string }) => Promise<void>,
 * }}
 */
export function useOfficerCall({ getToken }) {
  const [connection, setConnection] = useState('connecting');
  const clientRef = useRef(null);
  const signalHandler = useRef(() => {});
  const tokenGetter = useRef(getToken);
  useEffect(() => {
    tokenGetter.current = getToken;
  });

  const send = useCallback((signal) => {
    const client = clientRef.current;
    if (!client?.connected) return false;
    client.publish({ destination: CALL_SEND_DESTINATION, body: JSON.stringify(signal) });
    return true;
  }, []);

  const phone = useCall({
    send,
    getIceServers: () => getIceServers(),
    videoProfile: VIDEO_PROFILES.officer,
    facingMode: 'user',
  });
  useEffect(() => {
    signalHandler.current = phone.handleSignal;
  });

  useEffect(() => {
    const client = connectStomp({
      getToken: () => tokenGetter.current(),
      onStatusChange: setConnection,
      onConnect: (c) => {
        c.subscribe(CALLS_DESTINATION, (frame) => {
          try {
            signalHandler.current(JSON.parse(frame.body));
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
  }, []);

  const { startCall } = phone;
  const callCitizen = useCallback(
    (incident) => startCall({ incidentId: incident.id, peer: { name: incident.citizenName || null } }),
    [startCall],
  );

  return { ...phone, connection, callCitizen };
}
