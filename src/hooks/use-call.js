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
 * Four parties can call each other on one incident: the officer holding it ('officer'), the citizen ('citizen'),
 * the field officer opening their link ('field') and the ward officer the case was delegated to ('delegate'). `meta.to` says who we call; an incoming call is answered back
 * to its `from`. A call arriving while we are already talking does not get a busy tone right away: it waits in
 * `waiting` so the UI can ask "X muốn nối máy với bạn. Huỷ cuộc gọi hiện tại để nối máy?" (switchToWaiting /
 * declineWaiting).
 *
 * @returns {{
 *   call: null | { id, role, state, endedReason, peer, incidentId, to, localStream, remoteStream,
 *                  micOn, cameraOn, hasCamera, facingMode, quality, connectedAt },
 *   waiting: null | { callId, incidentId, from, peer },
 *   startCall: (meta: { incidentId: string, to?: 'officer'|'citizen'|'field'|'delegate', peer?: object }) => Promise<void>,
 *   handleSignal: (signal: object) => void, accept, reject, hangUp, dismiss, switchToWaiting, declineWaiting,
 *   setMic, setCamera, switchCamera, requestQuality,
 * }}
 */
const isActive = (session) => !!session && session.state !== 'ended';

/** Who is calling, as shown to the other side. */
export const CALL_ROLE_LABEL = {
  officer: 'Cán bộ nhận ca',
  citizen: 'Người báo tin',
  field: 'Người phụ trách hiện trường',
  delegate: 'Cán bộ được uỷ quyền',
};

/** "Đang gọi ..." while our call rings on the other side, by who we call. */
export const CALLING_TEXT = {
  officer: 'Đang gọi cán bộ nhận ca...',
  citizen: 'Đang gọi người báo tin...',
  field: 'Đang gọi người phụ trách hiện trường...',
  delegate: 'Đang gọi cán bộ được uỷ quyền...',
};

/** Role of the other side of a call (who called us, or who we called). */
export const callPeerRole = (call) => call?.peer?.role || call?.to || null;

/** "Người phụ trách hiện trường Lâm Thành Cường", "Người báo tin Võ Tịnh"... (role alone if no name). */
export const callPeerLabel = (call) =>
  [CALL_ROLE_LABEL[callPeerRole(call)], call?.peer?.name].filter(Boolean).join(' ');

const peerOf = (signal) => ({
  name: signal.peer_name || null,
  unitName: signal.unit_name || null,
  role: signal.from || null,
});

export function useCall({ send, getIceServers, videoProfile, facingMode = 'user' }) {
  const [call, setCall] = useState(null);
  const [waiting, setWaiting] = useState(null); // a second call ringing while we talk
  const waitingRef = useRef(null);
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
        send: (signal) => opts.current.send({ ...signal, incident_id: meta.incidentId, to: meta.to }),
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
            to: signal.from || meta?.to,
            peer: { ...peerOf(signal), name: signal.peer_name || meta?.peer?.name || null },
          }).accept(); // they meant to talk: no extra tap
          return;
        }
        if (isActive(current)) {
          if (current.callId === signal.call_id) return;
          // Already talking: keep the new call waiting and ask whether to switch (a third one gets "busy")
          if (waitingRef.current) {
            opts.current.send({
              call_id: signal.call_id,
              action: 'reject',
              reason: 'busy',
              incident_id: signal.incident_id,
              to: signal.from,
            });
            return;
          }
          const w = {
            callId: signal.call_id,
            incidentId: signal.incident_id,
            from: signal.from,
            peer: peerOf(signal),
          };
          waitingRef.current = w;
          setWaiting(w);
          return;
        }
        createSession(signal.call_id, 'callee', {
          incidentId: signal.incident_id,
          to: signal.from,
          peer: peerOf(signal),
        });
        return;
      }
      // we answered / declined on another device (same person, laptop + phone): stop ringing here
      if (signal.action === 'dismiss') {
        if (waitingRef.current?.callId === signal.call_id) {
          waitingRef.current = null;
          setWaiting(null);
        }
        if (current?.callId === signal.call_id && current.state === 'incoming') {
          sessionRef.current = null;
          metaRef.current = null;
          setCall(null);
        }
        return;
      }
      // the waiting caller gave up
      if (
        waitingRef.current?.callId === signal.call_id &&
        (signal.action === 'end' || signal.action === 'reject')
      ) {
        waitingRef.current = null;
        setWaiting(null);
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

  /** "Có": hang up the current call and answer the waiting one (runs from a click: camera + sound allowed). */
  const switchToWaiting = useCallback(() => {
    const w = waitingRef.current;
    if (!w) return;
    waitingRef.current = null;
    setWaiting(null);
    const old = sessionRef.current;
    sessionRef.current = null;
    old?.hangUp();
    createSession(w.callId, 'callee', { incidentId: w.incidentId, to: w.from, peer: w.peer }).accept();
  }, [createSession]);

  /** "Không": the waiting caller hears "busy". */
  const declineWaiting = useCallback(() => {
    const w = waitingRef.current;
    if (!w) return;
    waitingRef.current = null;
    setWaiting(null);
    opts.current.send({
      call_id: w.callId,
      action: 'reject',
      reason: 'busy',
      incident_id: w.incidentId,
      to: w.from,
    });
  }, []);

  /** Close the "call ended" screen. */
  const dismiss = useCallback(() => {
    if (isActive(sessionRef.current)) return;
    sessionRef.current = null;
    metaRef.current = null;
    setCall(null);
  }, []);

  return {
    call,
    waiting,
    switchToWaiting,
    declineWaiting,
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
