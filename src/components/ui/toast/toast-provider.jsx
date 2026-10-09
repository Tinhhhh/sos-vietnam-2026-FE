import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ToastContext } from './toast-context';
import styles from './toast.module.css';

const DEFAULT_DURATION = 3200;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, { tone = 'info', duration = DEFAULT_DURATION } = {}) => {
      const id = ++nextId.current;
      setToasts((list) => [...list, { id, message, tone }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className={styles.viewport} role="status" aria-live="polite">
          {toasts.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.toast} ${styles[t.tone] || ''}`}
              onClick={() => dismiss(t.id)}
            >
              {t.message}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
