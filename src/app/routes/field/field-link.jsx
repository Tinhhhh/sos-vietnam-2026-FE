import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';

import { CallSwitchDialog } from '@/components/ui/call-switch-dialog/call-switch-dialog';
import { FieldLinkPanel } from '@/features/incident-dispatch';
import { CitizenCallScreen } from '@/features/sos-tracking';
import { CALL_ROLE_LABEL, useCall } from '@/hooks/use-call';
import { connectStomp } from '@/lib/stomp-client';
import { VIDEO_PROFILES } from '@/lib/webrtc/call-session';
import { getIceServers } from '@/lib/webrtc/ice-servers';

import styles from './field-link.module.css';

const CALLS_DESTINATION = '/user/queue/calls';
const CALL_SEND_DESTINATION = '/app/calls';
const IN_CALL = ['ringing', 'connecting', 'live', 'reconnecting'];

/**
 * /f/:token — the field officer's link (no login, the code is the key). Composes the dispatch page with a phone
 * line: STOMP CONNECT with X-SOS-Field-Token, video calls to / from the citizen and the officer holding the case,
 * and the "nối máy" question when a second call comes in.
 */
export function FieldLinkRoute() {
  const { token } = useParams();
  const [incidentId, setIncidentId] = useState(null);
  const clientRef = useRef(null);
  const signalHandler = useRef(() => {});

  const send = useCallback((signal) => {
    const client = clientRef.current;
    if (!client?.connected) return false;
    client.publish({ destination: CALL_SEND_DESTINATION, body: JSON.stringify(signal) });
    return true;
  }, []);

  const phone = useCall({
    send,
    getIceServers: () => getIceServers({ fieldToken: token }),
    videoProfile: VIDEO_PROFILES.scene, // they film the scene for the officer
    facingMode: 'environment',
  });
  useEffect(() => {
    signalHandler.current = phone.handleSignal;
  });

  useEffect(() => {
    const client = connectStomp({
      getHeaders: () => ({ 'X-SOS-Field-Token': token }),
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
  }, [token]);

  const { call, dismiss } = phone;
  // the other side hung up / declined: back to the case page with a short note
  const ended = call?.state === 'ended';
  useEffect(() => {
    if (!ended) return undefined;
    const t = setTimeout(dismiss, 2500);
    return () => clearTimeout(t);
  }, [ended, dismiss]);
  const callTo = (to, name) => incidentId && phone.startCall({ incidentId, to, peer: { name, role: to } });
  const peerLabel = (c) => {
    const role = CALL_ROLE_LABEL[c?.peer?.role || c?.to] || '';
    return [role, c?.peer?.name].filter(Boolean).join(' ');
  };
  const switchDialog = (
    <CallSwitchDialog waiting={phone.waiting} onYes={phone.switchToWaiting} onNo={phone.declineWaiting} />
  );

  if (call && IN_CALL.includes(call.state)) {
    return (
      <>
        <CitizenCallScreen
          call={call}
          officerName={peerLabel(call)}
          onHangUp={phone.hangUp}
          onToggleMic={phone.setMic}
          onToggleCamera={phone.setCamera}
          onSwitchCamera={phone.switchCamera}
        />
        {switchDialog}
      </>
    );
  }

  return (
    <>
      <FieldLinkPanel token={token} onIncident={setIncidentId} onCall={callTo} callBusy={!incidentId} />
      {ended && <div className={styles.ended}>Cuộc gọi đã kết thúc</div>}
      {call?.state === 'incoming' && (
        <div className={styles.incoming} role="alertdialog" aria-label="Cuộc gọi đến">
          <div className={styles.incomingTitle}>{peerLabel(call) || 'Cuộc gọi'} đang gọi video</div>
          <div className={styles.incomingRow}>
            <button type="button" className={styles.reject} onClick={phone.reject}>
              Từ chối
            </button>
            <button type="button" className={styles.accept} onClick={phone.accept}>
              Nghe
            </button>
          </div>
        </div>
      )}
      {switchDialog}
    </>
  );
}
