import { useState } from 'react';

import { useNow } from '@/hooks/use-now';

import { CANCEL_REASONS } from '../api/tracking';
import styles from './sos-tracking.module.css';

const UNLOCK_MS = 5000;

/**
 * "Huỷ báo cáo" drop-up: opening it starts a 5 s lock, so a panicked or accidental tap cannot
 * cancel a real emergency. A reason is optional (kept for fake-alarm statistics later).
 * Renders the toggle button and the panel; the parent grid positions them.
 *
 * @param {{ busy: boolean, onConfirm: (reason: string | null) => void }} props
 */
export function CancelControl({ busy, onConfirm }) {
  const [openedAt, setOpenedAt] = useState(null);
  const [reason, setReason] = useState(null);
  const open = openedAt != null;
  const now = useNow(open, 250);
  const elapsed = open ? Math.min(UNLOCK_MS, now - openedAt) : 0;
  const unlocked = open && elapsed >= UNLOCK_MS;
  const secondsLeft = Math.ceil((UNLOCK_MS - elapsed) / 1000);

  const toggle = () => {
    if (open) {
      setOpenedAt(null);
      setReason(null);
    } else {
      setOpenedAt(Date.now());
    }
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.cancelToggle} ${open ? styles.cancelToggleOpen : ''}`}
        aria-expanded={open}
        onClick={toggle}
      >
        Huỷ báo cáo <span className={styles.chevron}>▾</span>
      </button>

      {open && (
        <div className={styles.cancelPanel} role="dialog" aria-label="Huỷ báo cáo SOS">
          <p className={styles.cancelHint}>
            Chỉ huỷ khi bạn đã an toàn hoặc bấm nhầm. Lý do (không bắt buộc):
          </p>
          <div className={styles.reasons}>
            {CANCEL_REASONS.map((r) => (
              <button
                key={r.code}
                type="button"
                className={`${styles.reason} ${reason === r.code ? styles.reasonOn : ''}`}
                onClick={() => setReason(reason === r.code ? null : r.code)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.confirmCancel}
            disabled={!unlocked || busy}
            onClick={() => onConfirm(reason)}
          >
            {!unlocked && (
              <i className={styles.unlockBar} style={{ width: `${(elapsed / UNLOCK_MS) * 100}%` }} />
            )}
            <span>
              {busy
                ? 'Đang huỷ...'
                : unlocked
                  ? 'Xác nhận huỷ báo cáo'
                  : `🔒 Mở khoá sau ${secondsLeft} giây`}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
