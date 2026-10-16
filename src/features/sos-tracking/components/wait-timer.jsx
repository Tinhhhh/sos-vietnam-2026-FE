import { formatDuration, timerMode } from '../utils/tracking-model';
import styles from './sos-tracking.module.css';

/**
 * Box next to "Huỷ báo cáo":
 * - ward police not yet taken: countdown to the hand-over to the province (15')
 * - otherwise: time waited since the report
 *
 * @param {{ incident: object, now: number }} props
 */
export function WaitTimer({ incident, now }) {
  if (timerMode(incident) === 'countdown') {
    const left = Math.max(0, (incident.escalateAt.getTime() - now) / 1000);
    const urgent = left < 5 * 60;
    return (
      <div
        className={`${styles.timerBox} ${urgent ? styles.timerUrgent : styles.timerCountdown}`}
        title="Quá 15 phút chưa có cán bộ xã/phường tiếp nhận thì tự chuyển lên cấp tỉnh/thành phố"
      >
        <span className={styles.timerLabel}>{left > 0 ? 'Chuyển lên tỉnh sau' : 'Đang chuyển lên tỉnh'}</span>
        <span className={styles.timerValue}>{formatDuration(left)}</span>
      </div>
    );
  }
  return (
    <div className={styles.timerBox} title="Thời gian từ lúc bạn gửi tín hiệu SOS">
      <span className={styles.timerLabel}>Đã chờ</span>
      <span className={styles.timerValue}>{formatDuration((now - incident.createdAt.getTime()) / 1000)}</span>
    </div>
  );
}
