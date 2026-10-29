import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import { confirmResolved } from '../api/tracking';
import styles from './sos-tracking.module.css';

/**
 * The officer wrote the closing report ("Đã xử lý xong") and waits for the citizen: pops up at once so they confirm,
 * then the case closes and the report to sign opens by itself (documentSlot). "Để sau" hides it until the page
 * reloads; the confirm button in "Theo dõi lực lượng" still works.
 * @param {{ incident: object, token: string, onUpdated: (incident) => void, notify: Function }} props
 */
export function CompletionPrompt({ incident, token, onUpdated, notify }) {
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const open =
    incident.status === 'RESOLVING' &&
    !!incident.officerConfirmedAt &&
    !incident.citizenConfirmedAt &&
    !later;

  useEffect(() => {
    if (open) navigator.vibrate?.([200, 100, 200]);
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    try {
      const updated = await confirmResolved(incident.id, token);
      if (updated) onUpdated(updated);
      notify('Đã xác nhận. Ca đã kết thúc, mời bạn xem và ký nhận văn bản báo cáo.', { tone: 'success' });
    } catch (err) {
      notify(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setLater(true)}
      solid
      containerStyle={{ maxWidth: 420 }}
      title="Lực lượng đã xác nhận xử lý xong"
    >
      <div className={styles.escalationBody} role="alert">
        <p>
          Cán bộ đã báo sự việc của bạn được xử lý xong. Bạn xác nhận để kết thúc tin báo, sau đó ký nhận văn
          bản báo cáo.
        </p>
        <button type="button" className={styles.completeOk} disabled={busy} onClick={confirm}>
          {busy ? 'Đang gửi...' : 'Xác nhận đã xử lý xong'}
        </button>
        <button type="button" className={styles.completeLater} disabled={busy} onClick={() => setLater(true)}>
          Chưa xong, để sau
        </button>
      </div>
    </Modal>
  );
}
