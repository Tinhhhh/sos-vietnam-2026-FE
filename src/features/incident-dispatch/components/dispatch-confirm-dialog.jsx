import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import styles from './dispatch.module.css';
import { FieldOfficerPicker } from './field-officer-picker';

/**
 * "Yêu cầu điều động": the field officer (người phụ trách hiện trường, GPS phone) must be picked right here,
 * before the case moves to RESOLVING and the dispatch window opens. "Huỷ" goes back to the queue.
 * @param {{ incident: object|null, busy?: boolean, onConfirm: (fieldMemberId: string) => void,
 *           onCancel: () => void }} props
 */
export function DispatchConfirmDialog({ incident, busy, onConfirm, onCancel }) {
  // one dialog per incident: the pick resets when another case opens it
  const [picked, setPicked] = useState({ incidentId: null, memberId: null });
  const fieldId = picked.incidentId === incident?.id ? picked.memberId : null;
  const place = incident
    ? [incident.address, incident.ward, incident.province].filter(Boolean).join(', ')
    : '';
  return (
    <Modal
      open={!!incident}
      onClose={busy ? () => {} : onCancel}
      solid
      containerStyle={{ maxWidth: 480, width: 'min(480px, calc(100vw - 16px))' }}
      title={<span className={styles.confirmTitle}>Xác nhận điều động lực lượng</span>}
    >
      {incident && (
        <div className={styles.confirmBody}>
          <p>
            Ca <b>{incident.id}</b> đã được xác minh và cần lực lượng tới hiện trường?
          </p>
          {place && <p className={styles.confirmPlace}>📍 {place}</p>}
          <FieldOfficerPicker
            incidentId={incident.id}
            value={fieldId}
            onChange={(memberId) => setPicked({ incidentId: incident.id, memberId })}
            compact
          />
          <p className={styles.confirmHint}>
            Sau khi xác nhận, ca chuyển sang <b>Đang điều động</b>; bạn chọn điểm xuất phát và đơn vị đi xử lý
            ở bước tiếp theo.
          </p>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.btnGhost} disabled={busy} onClick={onCancel}>
              Huỷ
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={busy || !fieldId}
              onClick={() => onConfirm(fieldId)}
            >
              {busy ? 'Đang gửi...' : fieldId ? 'Xác nhận điều động' : 'Chọn người phụ trách'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
