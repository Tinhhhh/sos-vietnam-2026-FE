import styles from './incident-panels.module.css';

/**
 * Sidebar tab "Sự Cố" (legacy #panelIncidentsView). The live queue arrives with the
 * dispatch module; for now it always shows the waiting shield.
 */
export function IncidentQueuePanel() {
  return (
    <div
      className={styles.panelIncidentsView}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}
    >
      <div
        className={`${styles.queueEmptyCosmicState} ${styles.queueEmptyCosmicStateRoot}`}
        style={{ display: 'flex' }}
      >
        <div className={styles.cosmicShieldSphereWrap}>
          <div className={`${styles.cosmicShieldOrbitRing} ${styles.ring1}`} />
          <div className={`${styles.cosmicShieldOrbitRing} ${styles.ring2}`} />
          <div className={`${styles.cosmicShieldOrbitRing} ${styles.ring3}`} />

          <div className={styles.cosmicShieldSphere}>
            <div className={styles.cosmicSphereHighlight} />
            <div className={styles.cosmicShieldCore}>
              <svg
                viewBox="0 0 24 24"
                className={styles.cosmicShieldSvg}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
          </div>

          <div className={`${styles.floatingParticle} ${styles.p1}`} />
          <div className={`${styles.floatingParticle} ${styles.p2}`} />
          <div className={`${styles.floatingParticle} ${styles.p3}`} />
        </div>

        <div className={styles.cosmicWaitingTitle}>Đang trực ban tín hiệu khẩn cấp...</div>
        <div className={styles.cosmicWaitingDesc}>
          Hệ thống đang cập nhật và xử lý các sự cố.
          <br />
          Vui lòng chờ trong giây lát.
        </div>
      </div>
    </div>
  );
}
