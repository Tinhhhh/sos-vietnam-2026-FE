import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';

import { acceptDelegation, arriveDispatch, departDelegation, rejectDelegation } from '../api/dispatch-api';
import { useDispatchPlan } from '../hooks/use-dispatch-plan';
import styles from './delegation.module.css';
import { DispatchTrackingView } from './dispatch-tracking-view';
import { FinishPanel } from './finish-panel';

const MIN_REASON = 5;

/**
 * Controls of a queue card that a higher unit delegated to my ward unit (step 2 "Uỷ quyền"):
 * - assigned to me, waiting: "Chấp nhận" / "Từ chối" (reason required, like a handover)
 * - accepted: "Lập tức điều động" (we set off: step 3, the citizen starts tracking)
 * - on the way: "Theo dõi" opens the tracking map
 * Colleagues of the unit see who it was given to.
 *
 * @param {{ incident: object }} props  live queue incident with its `delegation` block
 */
export function DelegationControls({ incident, onFinished }) {
  const toast = useToast();
  const d = incident.delegation;
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [tracking, setTracking] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const run = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      toast.show(success, { tone: 'success' });
      return true;
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  const mine = d.assignedToMe;
  const from = [d.fromUnit, d.fromOfficer].filter(Boolean).join(' · ');

  return (
    <div className={styles.box} onClick={(e) => e.stopPropagation()}>
      <div className={styles.head}>
        <span className={styles.badge}>Được uỷ quyền</span>
        <span className={styles.status}>{d.statusLabel}</span>
      </div>
      <div className={styles.meta}>
        {from && <>Từ: {from}. </>}
        {mine ? 'Giao cho bạn.' : `Giao cho ${d.assignedTo?.fullName || 'cán bộ đơn vị'}.`}
      </div>

      {mine && d.status === 'PENDING_ACCEPT' && !rejecting && (
        <div className={styles.row}>
          <button
            type="button"
            className={styles.reject}
            disabled={busy}
            onClick={stop(() => {
              setRejecting(true);
              setReason('');
            })}
          >
            Từ chối
          </button>
          <button
            type="button"
            className={styles.accept}
            disabled={busy}
            onClick={stop(() => run(() => acceptDelegation(incident.id), `Đã nhận ca ${incident.id}`))}
          >
            {busy ? 'Đang gửi...' : 'Chấp nhận'}
          </button>
        </div>
      )}

      {mine && rejecting && (
        <div className={styles.rejectBox}>
          <label className={styles.label} htmlFor={`reject-${incident.id}`}>
            Lý do từ chối *
          </label>
          <textarea
            id={`reject-${incident.id}`}
            className={styles.reason}
            rows={2}
            maxLength={255}
            value={reason}
            placeholder="Ví dụ: đơn vị đang xử lý vụ khác, không đủ lực lượng"
            onChange={(e) => setReason(e.target.value)}
          />
          {reason.trim().length > 0 && reason.trim().length < MIN_REASON && (
            <div className={styles.error}>Lý do ít nhất {MIN_REASON} ký tự</div>
          )}
          <div className={styles.row}>
            <button
              type="button"
              className={styles.ghost}
              disabled={busy}
              onClick={() => setRejecting(false)}
            >
              Huỷ
            </button>
            <button
              type="button"
              className={styles.reject}
              disabled={busy || reason.trim().length < MIN_REASON}
              onClick={async () => {
                const ok = await run(
                  () => rejectDelegation(incident.id, reason.trim()),
                  `Đã từ chối ca ${incident.id}`,
                );
                if (ok) setRejecting(false);
              }}
            >
              {busy ? 'Đang gửi...' : 'Xác nhận từ chối'}
            </button>
          </div>
        </div>
      )}

      {mine && d.status === 'ACCEPTED' && (
        <button
          type="button"
          className={styles.depart}
          disabled={busy}
          onClick={stop(() =>
            run(() => departDelegation(incident.id), 'Đã điều động: người báo tin đang theo dõi lực lượng'),
          )}
        >
          {busy ? 'Đang gửi...' : 'Lập tức điều động'}
        </button>
      )}

      {mine && d.status === 'EN_ROUTE' && (
        <button
          type="button"
          className={styles.depart}
          disabled={busy}
          onClick={stop(() =>
            run(() => arriveDispatch(incident.id), 'Đã tới hiện trường: chuyển sang bước Kết thúc'),
          )}
        >
          {busy ? 'Đang gửi...' : 'Khởi hành ngay'}
        </button>
      )}

      {mine && d.status === 'ARRIVED' && (
        <button type="button" className={styles.depart} onClick={stop(() => setFinishing(true))}>
          Kết thúc xử lý
        </button>
      )}

      {(d.status === 'EN_ROUTE' || d.status === 'ARRIVED') && (
        <button type="button" className={styles.track} onClick={stop(() => setTracking(true))}>
          Theo dõi
        </button>
      )}

      {tracking && <TrackingModal incident={incident} onClose={() => setTracking(false)} />}
      {finishing && (
        <FinishModal
          incident={incident}
          onClose={() => setFinishing(false)}
          onFinished={() => {
            setFinishing(false);
            onFinished?.(incident.id);
          }}
        />
      )}
    </div>
  );
}

function TrackingModal({ incident, onClose }) {
  const { plan, status } = useDispatchPlan({ incidentId: incident.id, refreshKey: incident });
  return (
    <Modal
      open
      onClose={onClose}
      solid
      containerStyle={{ maxWidth: 720, width: 'min(720px, calc(100vw - 16px))' }}
      title={<span className={styles.title}>Theo dõi lực lượng · Ca {incident.id}</span>}
    >
      {plan ? (
        <DispatchTrackingView plan={plan} incidentId={incident.id} />
      ) : (
        <div className={styles.meta}>
          {status === 'error' ? 'Không tải được kế hoạch điều động.' : 'Đang tải...'}
        </div>
      )}
    </Modal>
  );
}

function FinishModal({ incident, onClose, onFinished }) {
  const { plan } = useDispatchPlan({ incidentId: incident.id, refreshKey: incident });
  const [local, setLocal] = useState(null);
  const current = local && plan && local.citizenConfirmedAt === plan.citizenConfirmedAt ? local : plan;
  return (
    <Modal
      open
      onClose={onClose}
      solid
      containerStyle={{ maxWidth: 560, width: 'min(560px, calc(100vw - 16px))' }}
      title={<span className={styles.title}>Kết thúc xử lý · Ca {incident.id}</span>}
    >
      {current ? (
        <FinishPanel
          incidentId={incident.id}
          plan={current}
          canConfirm
          onPlan={setLocal}
          onFinished={onFinished}
        />
      ) : (
        <div className={styles.meta}>Đang tải...</div>
      )}
    </Modal>
  );
}
