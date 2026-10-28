import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import styles from './confirm-reason.module.css';

const MIN_REASON = 5;

/**
 * "Are you sure?" with a required reason (cancel / force-end a case). Mount it only while it is open
 * (the reason resets with each opening).
 *
 * @param {{ title: string, message: React.ReactNode, confirmLabel: string, placeholder?: string,
 *           busy?: boolean, extra?: React.ReactNode, canConfirm?: boolean, tags?: string[],
 *           secondary?: { label: string, title?: string, onConfirm: (reason: string) => void },
 *           onConfirm: (reason: string) => void, onClose: () => void }} props
 *   extra: more fields above the reason (e.g. the force to transfer to); canConfirm: those fields are valid;
 *   tags: quick reasons, a click fills the box with that text for the officer to edit (only the text is sent);
 *   secondary: a second action with the same reason (e.g. "Báo khống" in "Huỷ ca")
 */
export function ConfirmReasonDialog({
  title,
  message,
  confirmLabel,
  placeholder,
  busy = false,
  extra = null,
  canConfirm = true,
  tags = [],
  secondary = null,
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
        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                className={styles.tag}
                disabled={busy}
                onClick={() => setReason(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
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
          {secondary && (
            <button
              type="button"
              className={styles.danger}
              title={secondary.title}
              disabled={busy || short || !canConfirm}
              onClick={() => secondary.onConfirm(reason.trim())}
            >
              {secondary.label}
            </button>
          )}
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
