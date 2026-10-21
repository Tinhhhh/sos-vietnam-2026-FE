import { useCallback, useEffect, useRef, useState } from 'react';

import { CallSession, newCallId } from '@/lib/webrtc/call-session';
import { startRingtone } from '@/lib/webrtc/ringtone';

/**
 * React wrapper around one CallSession (citizen and officer use the same hook).
 * The owner wires the transport: `send` publishes a signal over STOMP, and every signal that
 * arrives on /user/queue/calls goes to `handleSignal`.
 *
 * @param {{
 *   send: (signal: object) => void,          // signal already has call_id; owner adds incident_id
 *   getIceServers: () => Promise<RTCIceServer[]>,
 *   videoProfile: object,                     // VIDEO_PROFILES.scene | VIDEO_PROFILES.officer
 *   facingMode?: 'user' | 'environment',
 * }} options
 * @returns {{
 *   call: null | { id, role, state, endedReason, peer, incidentId, localStream, remoteStream,
 *                  micOn, cameraOn, hasCamera, facingMode, quality, connectedAt },
 *   startCall: (meta: { incidentId: string, peer?: object }) => Promise<void>,
 *   handleSignal: (signal: object) => void, accept, reject, hangUp, dismiss,
 *   setMic, setCamera, switchCamera, requestQuality,
 * }}
 */
const isActive = (session) => !!session && session.state !== 'ended';

export function useCall({ send, getIceServers, videoProfile, facingMode = 'user' }) {
  const [call, setCall] = useState(null);
  const sessionRef = useRef(null);
  const metaRef = useRef(null); // { incidentId, peer } of the current call

  // Latest options without re-creating callbacks every render
  const opts = useRef({ send, getIceServers, videoProfile, facingMode });
  useEffect(() => {
    opts.current = { send, getIceServers, videoProfile, facingMode };
  });

  const snapshot = useCallback((s) => {
    setCall({
      id: s.callId,
      role: s.role,
      state: s.state,
      endedReason: s.endedReason,
      localStream: s.localStream,
      remoteStream: s.remoteStream,
      micOn: s.micOn,
      cameraOn: s.cameraOn,
      hasCamera: s.hasCamera,
      facingMode: s.facingMode,
      quality: s.quality,
      connectedAt: s.connectedAt,
      ...metaRef.current,
    });
  }, []);

  const createSession = useCallback(
    (callId, role, meta) => {
      metaRef.current = meta;
      const session = new CallSession({
        callId,
        role,
        send: (signal) => opts.current.send({ ...signal, incident_id: meta.incidentId }),
        getIceServers: () => opts.current.getIceServers(),
        videoProfile: opts.current.videoProfile,
        facingMode: opts.current.facingMode,
        onChange: (s) => {
          if (sessionRef.current === s) snapshot(s);
        },
      });
      sessionRef.current = session;
      snapshot(session);
      return session;
    },
    [snapshot],
  );

  const startCall = useCallback(
    async (meta) => {
      if (isActive(sessionRef.current)) return;
      await createSession(newCallId(), 'caller', meta).startOutgoing();
    },
    [createSession],
  );

  const handleSignal = useCallback(
    (signal) => {
      const current = sessionRef.current;
      if (signal.action === 'ring') {
        // Both sides pressed "call" at the same time (each is ringing the other): connect instead of
        // rejecting each other. Both compare the two call ids the same way, so exactly one call survives:
        // the side whose own call id is larger drops it and answers the other one.
        const glare =
          current?.role === 'caller' &&
          current.state === 'ringing' &&
          current.callId !== signal.call_id &&
          signal.incident_id === metaRef.current?.incidentId;
        if (glare) {
          if (current.callId < signal.call_id) return; // ours wins: the other side will answer it
          const meta = metaRef.current;
          sessionRef.current = null; // no "call ended" flash for the dropped call
          current.hangUp();
          createSession(signal.call_id, 'callee', {
            ...meta,
            peer: { name: signal.peer_name || meta?.peer?.name || null, unitName: signal.unit_name || null },
          }).accept(); // they meant to talk: no extra tap
          return;
        }
        if (isActive(current)) {
          // Already in another call: tell the new caller we are busy
          if (current.callId !== signal.call_id) {
            opts.current.send({ call_id: signal.call_id, action: 'reject', incident_id: signal.incident_id });
          }
          return;
        }
        createSession(signal.call_id, 'callee', {
          incidentId: signal.incident_id,
          peer: { name: signal.peer_name || null, unitName: signal.unit_name || null },
        });
        return;
      }
      if (current && current.callId === signal.call_id) current.handleSignal(signal);
    },
    [createSession],
  );

  // Ring tones follow the state
  const state = call?.state;
  useEffect(() => {
    if (state === 'incoming') return startRingtone('incoming');
    if (state === 'ringing') return startRingtone('outgoing');
    return undefined;
  }, [state]);

  // Leaving the page hangs up (closes camera / mic)
  useEffect(() => () => sessionRef.current?.hangUp(), []);

  // Stable action functions: they read the current session when called (never during render)
  const accept = useCallback(() => sessionRef.current?.accept(), []);
  const reject = useCallback(() => sessionRef.current?.reject(), []);
  const hangUp = useCallback(() => sessionRef.current?.hangUp(), []);
  const setMic = useCallback((on) => sessionRef.current?.setMic(on), []);
  const setCamera = useCallback((on) => sessionRef.current?.setCamera(on), []);
  const switchCamera = useCallback(() => sessionRef.current?.switchCamera(), []);
  const requestQuality = useCallback((q) => sessionRef.current?.requestQuality(q), []);

  /** Close the "call ended" screen. */
  const dismiss = useCallback(() => {
    if (isActive(sessionRef.current)) return;
    sessionRef.current = null;
    metaRef.current = null;
    setCall(null);
  }, []);

  return {
    call,
    startCall,
    handleSignal,
    accept,
    reject,
    hangUp,
    setMic,
    setCamera,
    switchCamera,
    requestQuality,
    dismiss,
  };
}
