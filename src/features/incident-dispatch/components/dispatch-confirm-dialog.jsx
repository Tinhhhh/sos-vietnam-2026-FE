import { Modal } from '@/components/ui/modal/modal';

import styles from './dispatch.module.css';

/**
 * "Xác nhận điều động?" before the case moves to RESOLVING and the dispatch window opens.
 * @param {{ incident: object|null, busy?: boolean, onConfirm: () => void, onCancel: () => void }} props
 */
export function DispatchConfirmDialog({ incident, busy, onConfirm, onCancel }) {
  const place = incident
    ? [incident.address, incident.ward, incident.province].filter(Boolean).join(', ')
    : '';
  return (
    <Modal
      open={!!incident}
      onClose={busy ? () => {} : onCancel}
      solid
      containerStyle={{ maxWidth: 440 }}
      title={<span className={styles.confirmTitle}>Xác nhận điều động lực lượng</span>}
    >
      {incident && (
        <div className={styles.confirmBody}>
          <p>
            Ca <b>{incident.id}</b> đã được xác minh và cần lực lượng tới hiện trường?
          </p>
          {place && <p className={styles.confirmPlace}>📍 {place}</p>}
          <p className={styles.confirmHint}>
            Sau khi xác nhận, ca chuyển sang <b>Đang điều động</b>; bạn chọn điểm xuất phát và đơn vị đi xử lý
            ở bước tiếp theo.
          </p>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.btnGhost} disabled={busy} onClick={onCancel}>
              Huỷ
            </button>
            <button type="button" className={styles.btnPrimary} disabled={busy} onClick={onConfirm}>
              {busy ? 'Đang gửi...' : 'Xác nhận điều động'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
