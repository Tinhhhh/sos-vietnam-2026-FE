import { formatDuration, timerMode } from '../utils/tracking-model';
import styles from './sos-tracking.module.css';

/**
 * Box next to "Huỷ báo cáo" (see timerMode):
 * - countdown to the 15-minute hand-over to the province
 * - past the deadline while the officer is still verifying: "Yêu cầu chuyển lên cấp tỉnh" button
 * - forces dispatched (RESOLVING): the same button, greyed out
 * - otherwise: time waited since the report
 *
 * @param {{ incident: object, now: number, busy?: boolean, onRequestProvince: () => void }} props
 */
export function WaitTimer({ incident, now, busy = false, onRequestProvince }) {
  const mode = timerMode(incident, now);

  if (mode === 'countdown') {
    const left = Math.max(0, (incident.escalateAt.getTime() - now) / 1000);
    const urgent = left < 5 * 60;
    const pending = incident.status === 'PENDING';
    return (
      <div
        className={`${styles.timerBox} ${urgent ? styles.timerUrgent : styles.timerCountdown}`}
        title={
          pending
            ? 'Quá 15 phút chưa có cán bộ xã/phường tiếp nhận thì tự chuyển lên cấp tỉnh/thành phố'
            : 'Quá 15 phút mà cán bộ chưa điều động lực lượng thì bạn được yêu cầu chuyển lên cấp tỉnh'
        }
      >
        <span className={styles.timerLabel}>
          {left > 0
            ? pending
              ? 'Chuyển lên tỉnh sau'
              : 'Được yêu cầu lên tỉnh sau'
            : 'Đang chuyển lên tỉnh'}
        </span>
        <span className={styles.timerValue}>{formatDuration(left)}</span>
      </div>
    );
  }

  if (mode === 'request' || mode === 'locked') {
    const locked = mode === 'locked';
    return (
      <button
        type="button"
        className={`${styles.timerBox} ${styles.provinceBtn}`}
        disabled={locked || busy}
        title={
          locked
            ? 'Lực lượng đã được điều động tới hiện trường'
            : 'Cán bộ đã nhận ca quá 15 phút mà chưa điều động lực lượng: chuyển tin báo lên cấp tỉnh/thành phố'
        }
        onClick={onRequestProvince}
      >
        <span className={styles.timerLabel}>{locked ? 'Đã điều động lực lượng' : 'Chưa được hỗ trợ?'}</span>
        <span className={styles.provinceBtnText}>
          {busy ? 'Đang gửi...' : '⚡ Yêu cầu chuyển lên cấp tỉnh'}
        </span>
      </button>
    );
  }

  return (
    <div className={styles.timerBox} title="Thời gian từ lúc bạn gửi tín hiệu SOS">
      <span className={styles.timerLabel}>Đã chờ</span>
      <span className={styles.timerValue}>{formatDuration((now - incident.createdAt.getTime()) / 1000)}</span>
    </div>
  );
}
