import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';

import { acceptDelegation, arriveDispatch, departDelegation, rejectDelegation } from '../api/dispatch-api';
import { useDispatchPlan } from '../hooks/use-dispatch-plan';
import { ArriveControl, DepartButton } from './arrive-control';
import styles from './delegation.module.css';
import { DispatchStepper } from './dispatch-stepper';
import { DispatchTrackingView } from './dispatch-tracking-view';
import { FieldLinkBox } from './field-link-box';
import { FieldOfficerChange, FieldOfficerList } from './field-officer-picker';
import { FinishPanel } from './finish-panel';

const MIN_REASON = 5;

/**
 * Controls of a queue card that a higher unit delegated to my ward unit (step 2 "Uỷ quyền"):
 * - assigned to me, waiting: "Chấp nhận" / "Từ chối" (reason required, like a handover)
 * - accepted: buttons like a held card: "Chi tiết điều động" (pick the field officer / GPS phone and set off,
 *   then tracking, "Đã đến", "Kết thúc xử lý"), "Gọi người giao uỷ quyền", and once someone set off
 *   "Gọi người phụ trách hiện trường"
 * Colleagues of the unit see who it was given to and can watch the tracking map.
 *
 * @param {{ incident: object }} props  live queue incident with its `delegation` block
 */
const OPENED = ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'];

/**
 * onCall(incident, to, name): video call from the delegated officer to the officer holding the case ('officer') or the
 * field officer ('field'), through the dashboard's phone line.
 */
export function DelegationControls({ incident, onFinished, onCall = null }) {
  const toast = useToast();
  const d = incident.delegation;
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState(false);

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

      {/* accepted: buttons like a held card; picking the field officer, tracking and finishing are in the window */}
      {mine && OPENED.includes(d.status) && (
        <div className={styles.grid}>
          <button type="button" className={styles.detail} onClick={stop(() => setDetail(true))}>
            Chi tiết điều động
          </button>
          {onCall && incident.handler && (
            <button
              type="button"
              className={styles.callHolder}
              title={`Gọi video cho ${incident.handler.fullName}`}
              onClick={stop(() => onCall(incident, 'officer', incident.handler.fullName))}
            >
              Gọi người giao uỷ quyền
            </button>
          )}
          {onCall && <FieldCallButton incident={incident} onCall={onCall} />}
        </div>
      )}

      {/* colleagues of the unit: watch only */}
      {!mine && (d.status === 'EN_ROUTE' || d.status === 'ARRIVED') && (
        <button type="button" className={styles.track} onClick={stop(() => setDetail(true))}>
          Theo dõi
        </button>
      )}

      {detail && (
        <DelegationDetailModal
          incident={incident}
          mine={mine}
          onClose={() => setDetail(false)}
          onCallReceiver={
            mine && onCall
              ? (receiver) => {
                  setDetail(false);
                  onCall(incident, 'officer', receiver.fullName);
                }
              : null
          }
          onCallField={
            mine && onCall
              ? (tracker) => {
                  setDetail(false); // the call pane takes over
                  onCall(incident, 'field', tracker.fullName);
                }
              : null
          }
          onFinished={() => {
            setDetail(false);
            onFinished?.(incident.id);
          }}
        />
      )}
    </div>
  );
}

/** "Gọi người phụ trách hiện trường" once someone set off (name read from the plan). */
function FieldCallButton({ incident, onCall }) {
  const { plan } = useDispatchPlan({ incidentId: incident.id, refreshKey: incident });
  const tracker = plan?.tracker;
  if (!tracker) return null;
  return (
    <button
      type="button"
      className={styles.callField}
      title={`Gọi video cho ${tracker.fullName}`}
      onClick={(e) => {
        e.stopPropagation();
        onCall(incident, 'field', tracker.fullName);
      }}
    >
      Gọi người phụ trách hiện trường
    </button>
  );
}

/** Steps as the delegating officer sees them; the ward officer joins at step 2 "Uỷ quyền". */
const STEPS = [
  { key: 'route', title: 'Chọn tuyến' },
  { key: 'delegate', title: 'Uỷ quyền' },
  { key: 'track', title: 'Theo dõi' },
  { key: 'finish', title: 'Kết thúc' },
];
// step 2 only while choosing who goes; once chosen it is "Theo dõi" ("Khởi hành" on the card)
const STEP_OF = { ACCEPTED: 'track', EN_ROUTE: 'track', ARRIVED: 'finish', DONE: 'finish' };

/**
 * "Chi tiết điều động" of the delegated ward officer: the steps, the map and route, then
 * - accepted, nobody chosen (step 2): the unit's officers, "Chọn"
 * - chosen, not gone yet (step 3): the tracking card with "Khởi hành" in place of "Đã đến" (simulation greyed out
 *   until then), change the person, field link
 * - on the way (step 3): tracking (call / simulate), change the person, field link, "Đã đến"
 * - arrived (step 4): tracking + "Kết thúc xử lý"
 * Colleagues (not assigned) only see the tracking map.
 */
function DelegationDetailModal({ incident, mine, onClose, onCallField, onCallReceiver, onFinished }) {
  const { plan, status } = useDispatchPlan({ incidentId: incident.id, refreshKey: incident });
  const [local, setLocal] = useState(null);
  // the answer of my last click until the next poll / push brings a newer plan
  const current = pickNewer(local, plan);
  const st = current?.status;
  const choosing = mine && st === 'ACCEPTED' && !current?.tracker;

  let body;
  if (!current) {
    body = (
      <div className={styles.meta}>
        {status === 'error' ? 'Không tải được kế hoạch điều động.' : 'Đang tải...'}
      </div>
    );
  } else {
    body = (
      <div className={styles.detailBody}>
        <DispatchStepper steps={STEPS} current={choosing ? 'delegate' : STEP_OF[st] || 'track'} />
        <DispatchTrackingView
          plan={current}
          incidentId={incident.id}
          onCallTracker={onCallField}
          onCallReceiver={onCallReceiver}
          // chosen, not gone: "Khởi hành" where "Đã đến" goes
          renderDepart={
            mine && current.tracker
              ? () => (
                  <DepartButton
                    who={current.tracker.fullName}
                    onDepart={() => departDelegation(incident.id)}
                    onPlan={setLocal}
                  />
                )
              : null
          }
          // "Đã đến" only within the GPS radius (no override here: only the officer holding the case has one)
          renderArrive={
            mine
              ? (check) => (
                  <ArriveControl
                    check={check}
                    onArrive={() => arriveDispatch(incident.id)}
                    onPlan={setLocal}
                  />
                )
              : null
          }
        />
        {/* below the ETA / receiver / delegate card, so the officer reads who is involved first */}
        {choosing && (
          <FieldOfficerList incidentId={incident.id} onPlan={setLocal} />
        )}
        {mine && current.tracker && (st === 'ACCEPTED' || st === 'EN_ROUTE') && (
          <>
            <FieldOfficerChange incidentId={incident.id} plan={current} onPlan={setLocal} />
            <FieldLinkBox incidentId={incident.id} plan={current} />
          </>
        )}
        {mine && st === 'ARRIVED' && (
          <FinishPanel
            incidentId={incident.id}
            plan={current}
            canConfirm
            onPlan={setLocal}
            onFinished={onFinished}
          />
        )}
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      solid
      containerStyle={{ maxWidth: 1000, width: 'min(1000px, calc(100vw - 16px))' }}
      title={<span className={styles.title}>Điều động lực lượng · Ca {incident.id}</span>}
    >
      {body}
    </Modal>
  );
}

/** My click's answer wins until the polled plan moves on (another status / person / confirmation). */
function pickNewer(local, plan) {
  if (!local) return plan;
  if (!plan) return local;
  const same =
    local.status === plan.status &&
    local.tracker?.memberId === plan.tracker?.memberId &&
    local.citizenConfirmedAt === plan.citizenConfirmedAt;
  return same ? plan : local.dispatchId === plan.dispatchId && rank(local) > rank(plan) ? local : plan;
}
const RANK = { ACCEPTED: 1, EN_ROUTE: 2, ARRIVED: 3, DONE: 4 };
function rank(p) {
  return (RANK[p.status] || 0) * 2 + (p.tracker ? 1 : 0);
}
