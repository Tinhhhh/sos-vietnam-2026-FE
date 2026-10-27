import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useToast } from '@/components/ui/toast/toast-context';

import { arriveDispatch, confirmHandled } from '../api/dispatch-api';
import { useDispatchPlan } from '../hooks/use-dispatch-plan';
import styles from './dispatch-tracking.module.css';
import { DispatchTrackingView } from './dispatch-tracking-view';

const TRACK_STEP = 3;

/**
 * "..." on the citizen's screens (video call controls and the waiting screen). A red dot shows once the
 * dispatch reaches step 3 "Theo dõi" and the citizen has not opened it yet; tapping opens the tracking
 * sheet (full screen on phones, a centred panel on wide screens).
 *
 * @param {{ incident: object, token: string, variant?: 'call' | 'screen' }} props
 *   incident = live tracking incident (re-read the plan on every push), token = citizen access token
 */
export function CitizenDispatchButton({
  incident,
  token,
  variant = 'screen',
  callTracker = null,
  callReceiver = null,
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(null); // dispatch id + step already opened
  const { plan } = useDispatchPlan({
    incidentId: incident.id,
    citizenToken: token,
    enabled: incident.status === 'RESOLVING' || incident.status === 'RESOLVED',
    refreshKey: incident,
  });
  const tracking = !!plan && plan.step >= TRACK_STEP;
  const mark = plan ? `${plan.dispatchId}:${plan.step}` : null;
  const unread = tracking && seen !== mark;

  return (
    <>
      <button
        type="button"
        className={`${styles.moreBtn} ${variant === 'call' ? styles.moreCall : styles.moreScreen}`}
        aria-label={tracking ? 'Theo dõi lực lượng đang tới' : 'Theo dõi điều động'}
        title={tracking ? 'Theo dõi lực lượng đang tới' : 'Lực lượng chưa xuất phát'}
        onClick={() => {
          setSeen(mark);
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="5" cy="12" r="2.2" fill="currentColor" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          <circle cx="19" cy="12" r="2.2" fill="currentColor" />
        </svg>
        {unread && <i className={styles.redDot} aria-hidden="true" />}
      </button>
      {open && (
        <TrackingSheet
          plan={tracking ? plan : null}
          incidentId={incident.id}
          token={token}
          onCallTracker={
            callTracker
              ? (tracker) => {
                  setOpen(false); // the call screen takes over
                  callTracker(tracker);
                }
              : null
          }
          onCallReceiver={
            callReceiver
              ? () => {
                  setOpen(false);
                  callReceiver();
                }
              : null
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TrackingSheet({ plan, incidentId, token, onCallTracker, onCallReceiver, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className={styles.sheetBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Theo dõi lực lượng"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.sheet}>
        <div className={styles.sheetHead}>
          <span className={styles.sheetTitle}>Theo dõi lực lượng</span>
          <button type="button" className={styles.sheetClose} aria-label="Đóng" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {plan ? (
          <DispatchTrackingView
            plan={plan}
            incidentId={incidentId}
            citizenToken={token}
            onCallTracker={onCallTracker}
            onCallReceiver={onCallReceiver}
            variant="sheet"
            footer={
              plan.status === 'EN_ROUTE' ? (
                <CitizenArrive incidentId={incidentId} token={token} />
              ) : (
                plan.status === 'ARRIVED' && (
                  <CitizenConfirm
                    incidentId={incidentId}
                    token={token}
                    confirmed={!!plan.citizenConfirmedAt}
                  />
                )
              )
            }
          />
        ) : (
          <div className={styles.empty}>
            Lực lượng chức năng đang chọn đơn vị phù hợp. Khi lực lượng xuất phát, nút ⋯ sẽ có dấu chấm đỏ và
            bạn theo dõi được đường đi tại đây.
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Step 3 for the citizen: "the force is here" (one side is enough: the officer may press it too). */
function CitizenArrive({ incidentId, token }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={styles.confirmBtn}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await arriveDispatch(incidentId, { citizenToken: token });
          toast.show('Đã báo lực lượng tới nơi.', { tone: 'success' });
        } catch (err) {
          toast.show(err.message, { tone: 'error' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Đang gửi...' : 'Đã đến'}
    </button>
  );
}

/** Step 4 for the citizen: "Đã xử lý xong" only records the confirmation; the officer then closes the case. */
function CitizenConfirm({ incidentId, token, confirmed }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (confirmed || done) {
    return <div className={styles.confirmed}>Đã xác nhận, chờ cán bộ hoàn tất. Cảm ơn bạn đã báo tin.</div>;
  }
  return (
    <button
      type="button"
      className={styles.confirmBtn}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const next = await confirmHandled(incidentId, { citizenToken: token });
          setDone(true);
          // cán bộ đã xác nhận trước thì xác nhận của dân là đủ hai bên: ca kết thúc
          toast.show(
            next?.officerConfirmedAt
              ? 'Đã xác nhận. Ca đã kết thúc, cảm ơn bạn đã báo tin.'
              : 'Đã xác nhận, chờ cán bộ hoàn tất.',
            { tone: 'success' },
          );
        } catch (err) {
          toast.show(err.message, { tone: 'error' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Đang gửi...' : 'Đã xử lý xong'}
    </button>
  );
}
