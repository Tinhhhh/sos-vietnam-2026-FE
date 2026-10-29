import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import styles from './sos-tracking.module.css';

const seenKey = (id) => `sos_escalation_seen_${id}`;
const readSeen = (id) => {
  try {
    return localStorage.getItem(seenKey(id));
  } catch {
    return null;
  }
};

const TEXT = {
  OFFICER_REQUEST: {
    title: 'Công an xã/phường đã chuyển ca lên cấp tỉnh',
    body: 'Công an xã/phường đã chuyển tin báo của bạn lên Công an tỉnh/thành phố để xử lý. Cán bộ cấp tỉnh sẽ liên hệ với bạn ngay, vui lòng giữ máy.',
  },
  NO_RESPONSE_TIMEOUT: {
    title: 'Tin báo đã được chuyển lên cấp tỉnh',
    body: 'Quá thời hạn mà chưa có cán bộ xã/phường tiếp nhận, hệ thống đã tự chuyển tin báo của bạn lên Công an tỉnh/thành phố. Vui lòng giữ máy.',
  },
};

/**
 * Tells the citizen, once per case, that the case moved to the province (the ward officer moved it, or the 15-minute
 * deadline passed). Their own "Yêu cầu chuyển lên cấp tỉnh" already says so with a toast. Remembered on the device.
 * @param {{ incident: object, closed: boolean }} props
 */
export function EscalationNotice({ incident, closed }) {
  const [seen, setSeen] = useState(() => readSeen(incident.id));
  const at = incident.escalatedAt ? incident.escalatedAt.toISOString() : null;
  const text = TEXT[incident.escalationReason];
  const open = !!at && !!text && !closed && seen !== at;

  useEffect(() => {
    if (open) navigator.vibrate?.([200, 100, 200]);
  }, [open]);

  const dismiss = () => {
    try {
      localStorage.setItem(seenKey(incident.id), at);
    } catch {
      // storage blocked: shown again on the next visit
    }
    setSeen(at);
  };

  return (
    <Modal open={open} onClose={dismiss} solid containerStyle={{ maxWidth: 420 }} title={text?.title}>
      <div className={styles.escalationBody} role="alert">
        <p>{text?.body}</p>
        <button type="button" className={styles.escalationOk} onClick={dismiss}>
          Đã hiểu
        </button>
      </div>
    </Modal>
  );
}
