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
  // the window itself stays put (title row + close button); only its body scrolls. Layout props go to the body.
  const { display, flexDirection, gap, ...shellStyle } = containerStyle || {};

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
        className={`${solid ? `modal-container ${styles.solid}` : 'modal-container liquid-glass'} ${styles.shell}`}
        style={shellStyle}
      >
        <button
          type="button"
          className={`btn-close-modal ${styles.close}`}
          aria-label="Đóng"
          onClick={onClose}
        >
          &times;
        </button>
        {/* title row outside the scrolling body: the scrollbar starts under its line */}
        <div className={`modal-header ${styles.header}`}>
          <div className="modal-title" id={titleId} style={titleStyle}>
            {title}
          </div>
        </div>
        <div className={styles.body} style={{ display, flexDirection, gap }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
