import { formatDuration, timerMode } from '../utils/tracking-model';
import styles from './sos-tracking.module.css';

/**
 * Box next to "Huỷ báo cáo" (see timerMode):
 * - before the 15-minute deadline: "Yêu cầu chuyển lên cấp tỉnh" greyed out, with the time left
 * - past the deadline and forces not dispatched yet: the same button, active
 * - forces dispatched (RESOLVING): the same button, greyed out
 * - otherwise: time waited since the report
 *
 * @param {{ incident: object, now: number, busy?: boolean, onRequestProvince: () => void }} props
 */
export function WaitTimer({ incident, now, busy = false, onRequestProvince }) {
  const mode = timerMode(incident, now);

  if (mode === 'countdown') {
    const left = Math.max(0, (incident.escalateAt.getTime() - now) / 1000);
    const pending = incident.status === 'PENDING';
    return (
      <button
        type="button"
        className={`${styles.timerBox} ${styles.provinceBtn}`}
        disabled
        title={
          pending
            ? 'Quá 15 phút chưa có lực lượng chức năng xã/phường tiếp nhận thì tin báo tự chuyển lên cấp tỉnh, hoặc bạn bấm nút này'
            : 'Quá 15 phút mà vẫn chưa điều động lực lượng thì bạn được yêu cầu chuyển lên cấp tỉnh'
        }
      >
        <span className={styles.timerLabel}>Bấm được sau {formatDuration(left)}</span>
        <span className={styles.provinceBtnText}>⚡ Yêu cầu chuyển lên cấp tỉnh</span>
      </button>
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
            : 'Đã quá 15 phút mà chưa có lực lượng được điều động: chuyển tin báo lên cấp tỉnh/thành phố'
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
