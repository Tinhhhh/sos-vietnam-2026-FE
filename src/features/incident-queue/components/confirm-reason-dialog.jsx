import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import styles from './confirm-reason.module.css';

const MIN_REASON = 5;

/**
 * "Are you sure?" with a required reason (cancel / force-end a case). Mount it only while it is open
 * (the reason resets with each opening).
 *
 * @param {{ title: string, message: React.ReactNode, confirmLabel: string, placeholder?: string,
 *           busy?: boolean, extra?: React.ReactNode, canConfirm?: boolean,
 *           onConfirm: (reason: string) => void, onClose: () => void }} props
 *   extra: more fields above the reason (e.g. the force to transfer to); canConfirm: those fields are valid
 */
export function ConfirmReasonDialog({
  title,
  message,
  confirmLabel,
  placeholder,
  busy = false,
  extra = null,
  canConfirm = true,
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('');
  const short = reason.trim().length < MIN_REASON;
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      solid
      containerStyle={{ maxWidth: 460 }}
      title={<span className={styles.title}>{title}</span>}
    >
      <div className={styles.body}>
        <div className={styles.message}>{message}</div>
        {extra}
        <label className={styles.label} htmlFor="confirm-reason">
          Lý do *
        </label>
        <textarea
          id="confirm-reason"
          className={styles.reason}
          rows={3}
          maxLength={255}
          value={reason}
          placeholder={placeholder}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
        />
        {reason.trim().length > 0 && short && (
          <div className={styles.error}>Lý do ít nhất {MIN_REASON} ký tự</div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={busy} onClick={onClose}>
            Không
          </button>
          <button
            type="button"
            className={styles.danger}
            disabled={busy || short || !canConfirm}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? 'Đang gửi...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
