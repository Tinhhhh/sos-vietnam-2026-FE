import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';

import styles from './arrive-control.module.css';

const MIN_REASON = 5;

/**
 * "Khởi hành": the field officer has been chosen (trip ACCEPTED); pressing it starts the trip (EN_ROUTE), from then
 * on the BE takes GPS points and the simulation can run. Pressed by whoever chose the person or by the field officer
 * on their link page.
 *
 * @param {{ onDepart: () => Promise<object>, onPlan?: (plan) => void, who?: string|null }} props
 */
export function DepartButton({ onDepart, onPlan, who = null }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const next = await onDepart();
      onPlan?.(next);
      toast.show('Đã khởi hành: bắt đầu nhận GPS, người báo tin đang theo dõi', { tone: 'success' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.depart}>
      <div className={styles.note}>
        {who ? (
          <>
            <b>{who}</b> phụ trách hiện trường. Bấm "Khởi hành" khi xuất phát (người đi cũng bấm được trên
            link):
          </>
        ) : (
          'Bấm "Khởi hành" khi xuất phát:'
        )}{' '}
        từ lúc đó mới nhận GPS và theo dõi xe.
      </div>
      <button type="button" className={styles.primary} disabled={busy} onClick={go}>
        {busy ? 'Đang gửi...' : 'Khởi hành'}
      </button>
    </div>
  );
}

/**
 * "Đã đến": only when the last GPS point is within 30 m (+ its accuracy, max 50 m) of the destination
 * (plan.arrivalCheck from the BE, refreshed every 5 s with the live position). Who handles the case (the holder of an
 * own-unit trip, the delegated ward officer) and the field officer on their link can still confirm without GPS
 * (phone dead, no signal) with a reason (canOverride); the province holder of a delegated case cannot.
 *
 * @param {{ check: null | { distanceM, thresholdM, within }, onArrive: (reason?: string) => Promise<object>,
 *           onPlan?: (plan) => void, canOverride?: boolean }} props
 */
export function ArriveControl({ check, onArrive, onPlan, canOverride = false }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  const send = async (reason) => {
    setBusy(true);
    try {
      const next = await onArrive(reason);
      onPlan?.(next);
      setAsking(false);
      toast.show('Lực lượng đã tới hiện trường: chuyển sang bước Kết thúc', { tone: 'success' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const within = !!check?.within;
  const hint = !check
    ? 'Chưa có tín hiệu GPS của người đi hiện trường'
    : within
      ? `Đã trong bán kính điểm đến (${check.distanceM} m)`
      : `Còn ${check.distanceM} m tới điểm đến (bấm được khi trong ${check.thresholdM} m)`;

  return (
    <div className={styles.arrive}>
      <button
        type="button"
        className={styles.primary}
        disabled={busy || !within}
        title={hint}
        onClick={() => send()}
      >
        {busy && !asking ? 'Đang gửi...' : 'Đã đến'}
      </button>
      <div className={within ? styles.ok : styles.note} role="status">
        {hint}
      </div>
      {canOverride && !within && (
        <button type="button" className={styles.link} onClick={() => setAsking(true)}>
          Không có GPS? Xác nhận đã đến (ghi lý do)
        </button>
      )}
      {asking && <OverrideDialog busy={busy} onConfirm={send} onClose={() => setAsking(false)} />}
    </div>
  );
}

/** Confirm the arrival without GPS: reason required (kept with the trip). */
function OverrideDialog({ busy, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const short = reason.trim().length < MIN_REASON;
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      solid
      containerStyle={{ maxWidth: 460, width: 'min(460px, calc(100vw - 16px))' }}
      title={<span className={styles.title}>Xác nhận đã đến không theo GPS</span>}
    >
      <div className={styles.dialog}>
        <p>
          Dùng khi điện thoại của người đi hiện trường mất GPS / hết pin nhưng lực lượng đã có mặt. Lý do được
          lưu cùng lượt điều động.
        </p>
        <label className={styles.label} htmlFor="arrive-override-reason">
          Lý do *
        </label>
        <textarea
          id="arrive-override-reason"
          className={styles.reason}
          rows={3}
          maxLength={255}
          value={reason}
          placeholder="Ví dụ: điện thoại người đi hết pin, đã gọi xác nhận có mặt"
          onChange={(e) => setReason(e.target.value)}
        />
        {reason.trim().length > 0 && short && (
          <div className={styles.error}>Lý do ít nhất {MIN_REASON} ký tự</div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={busy} onClick={onClose}>
            Huỷ
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || short}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? 'Đang gửi...' : 'Xác nhận đã đến'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
