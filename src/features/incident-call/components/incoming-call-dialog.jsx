import { CallIcon } from '@/components/ui/call-icons/call-icons';

import styles from './incident-call.module.css';

/**
 * The citizen or the field officer calls the officer holding the incident: small ringing card at the
 * bottom right of the console.
 *
 * @param {{ call: object, onAccept: () => void, onReject: () => void }} props
 */
export function IncomingCallDialog({ call, onAccept, onReject }) {
  return (
    <div className={styles.incoming} role="alertdialog" aria-label="Cuộc gọi đến từ người báo">
      <div className={styles.incomingTitle}>
        <span className={styles.incomingIcon}>
          <CallIcon name="phone" />
        </span>
        {call.peer?.role === 'field'
          ? `Người phụ trách hiện trường ${call.peer?.name || ''}`.trim()
          : call.peer?.name || 'Người báo'}{' '}
        đang gọi video
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
  );
}
