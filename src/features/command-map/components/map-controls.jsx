import styles from './map-controls.module.css';

/** Compass + zoom buttons, bottom-left of the map (legacy .map-bottom-left-controls). */
export function MapControls({ bearing = 0, onResetNorth, onZoomIn, onZoomOut }) {
  return (
    <div className={styles.mapBottomLeftControls}>
      <div className={`${styles.compassWidget} liquid-glass`} title="Hướng Bắc" onClick={onResetNorth}>
        <span className={styles.compassArrow} style={{ transform: `rotate(${-bearing}deg)` }}>
          ▲
        </span>
        <span className={styles.compassLetter}>N</span>
      </div>
      <div className={`${styles.zoomControlsPill} liquid-glass`}>
        <button type="button" className={styles.zoomBtn} title="Phóng to" onClick={onZoomIn}>
          +
        </button>
        <div className={styles.zoomDivider} />
        <button type="button" className={styles.zoomBtn} title="Thu nhỏ" onClick={onZoomOut}>
          −
        </button>
      </div>
    </div>
  );
}
