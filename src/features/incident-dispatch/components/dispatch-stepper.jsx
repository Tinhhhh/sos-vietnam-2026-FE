import styles from './dispatch.module.css';

/**
 * Progress bar of a dispatch. The window decides which steps this officer has (ward police have
 * no "Uỷ quyền"), so the bar only draws what it is given, numbered from 1.
 *
 * @param {{ steps: { key: string, title: string, skipped?: boolean }[], current: string }} props
 *   current = key of the step in progress; a skipped step shows "Không cần".
 */
export function DispatchStepper({ steps, current }) {
  const at = Math.max(
    0,
    steps.findIndex((s) => s.key === current),
  );
  return (
    <ol className={styles.stepper} style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'pending';
        const label = s.skipped
          ? 'Không cần'
          : state === 'done'
            ? 'Hoàn tất'
            : state === 'current'
              ? 'Đang thực hiện'
              : 'Chờ';
        return (
          <li key={s.key} className={`${styles.step} ${styles[state]}`}>
            <div className={styles.stepHead}>
              <span className={styles.stepDot} aria-hidden="true">
                {state === 'done' ? '✓' : ''}
              </span>
              {i < steps.length - 1 && <span className={styles.stepBar} />}
            </div>
            <div className={styles.stepNo}>BƯỚC {i + 1}</div>
            <div className={styles.stepTitle}>{s.title}</div>
            <div className={styles.stepState}>{label}</div>
          </li>
        );
      })}
    </ol>
  );
}
