import styles from './zoom-bar.module.css';

/**
 * "− 100% +" zoom pill (maps, the citizen's report document). Pressing the percentage goes back to the
 * default view (no separate reset button).
 *
 * @param {{ pct: number, onIn: () => void, onOut: () => void, onReset: () => void, className?: string,
 *           label?: string }} props
 */
export function ZoomBar({ pct, onIn, onOut, onReset, className = '', label = 'Thu phóng' }) {
  return (
    <div className={`${styles.bar} ${className}`} role="group" aria-label={label}>
      <button type="button" className={styles.btn} onClick={onOut} aria-label="Thu nhỏ 25%">
        −
      </button>
      <button
        type="button"
        className={styles.pct}
        onClick={onReset}
        aria-live="polite"
        aria-label={`${pct}%, bấm để về mức mặc định`}
        title="Về mức mặc định"
      >
        {pct}%
      </button>
      <button type="button" className={styles.btn} onClick={onIn} aria-label="Phóng to 25%">
        +
      </button>
    </div>
  );
}
