import styles from './status-screen.module.css';

/** Shown while a lazy route chunk loads on first visit (React Router HydrateFallback). */
export function RouteLoading() {
  return <div className={styles.screen} aria-busy="true" aria-label="Đang tải" />;
}
