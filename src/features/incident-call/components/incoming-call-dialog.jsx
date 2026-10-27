import { CallIcon } from '@/components/ui/call-icons/call-icons';
import { callPeerLabel, callPeerRole } from '@/hooks/use-call';

import styles from './incident-call.module.css';

/**
 * Someone (citizen, field officer, delegated officer...) calls this officer: ringing card in the middle of the
 * screen, the console behind dimmed and blurred.
 *
 * @param {{ call: object, onAccept: () => void, onReject: () => void }} props
 */
export function IncomingCallDialog({ call, onAccept, onReject }) {
  return (
    <div className={styles.incomingBackdrop}>
      <div className={styles.incoming} role="alertdialog" aria-label="Cuộc gọi đến từ người báo">
        <div className={styles.incomingTitle}>
          <span className={styles.incomingIcon}>
            <CallIcon name="phone" />
          </span>
          {callPeerRole(call) === 'citizen' ? call.peer?.name || 'Người báo' : callPeerLabel(call)} đang gọi
          video
        </div>
        <p className={styles.incomingSub}>Ca {call.incidentId}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className={`${styles.pill} ${styles.pillGreen}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={onAccept}
          >
            <CallIcon name="phone" /> Nghe
          </button>
          <button
            type="button"
            className={`${styles.pill} ${styles.pillRed}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={onReject}
          >
            <CallIcon name="hangup" /> Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
