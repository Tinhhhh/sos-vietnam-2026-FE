import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import styles from './modal.module.css';

/**
 * Legacy modal shell: `.modal-backdrop` toggled with `.is-open`
 * (see legacy-global.css). Kept mounted so the legacy open/close
 * transition still plays.
 * `solid`: opaque panel instead of the see-through liquid glass (the page behind
 * stays hidden, e.g. the SOS form).
 */
export function Modal({ open, onClose, title, titleStyle, containerStyle, solid = false, children }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return createPortal(
    <div
      className={`modal-backdrop${open ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden={!open}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={solid ? `modal-container ${styles.solid}` : 'modal-container liquid-glass'}
        style={containerStyle}
      >
        <div className="modal-header">
          <div className="modal-title" id={titleId} style={titleStyle}>
            {title}
          </div>
          <button type="button" className="btn-close-modal" aria-label="Đóng" onClick={onClose}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
