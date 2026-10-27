import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { delegateDispatch, getDelegationCandidates, withdrawDelegation } from '../api/dispatch-api';
import styles from './delegation.module.css';

/**
 * Step 2 "Uỷ quyền" of the delegating (province) officer: officers of the chosen ward station's unit with
 * online / offline, phone and "Lập tức liên hệ"; then the waiting state until that officer accepts. While waiting
 * the plan is locked, but the delegation can be withdrawn (no answer / cannot reach them) to choose again.
 *
 * @param {{ incidentId: string, plan: object, onPlan: (plan) => void, locked?: boolean }} props
 *   locked = waiting for the officer's answer: the recipient cannot be changed
 */
export function DelegationStep({ incidentId, plan, onPlan, locked = false }) {
  const [changing, setChanging] = useState(false);
  const who = plan.assignedTo;

  if (who && !changing) {
    const accepted = plan.status === 'ACCEPTED';
    return (
      <div className={styles.panel}>
        <div className={`${styles.waiting} ${accepted ? styles.accepted : ''}`}>
          {!accepted && <span className={styles.spinner} aria-hidden="true" />}
          <div>
            <div>
              {accepted && plan.tracker && plan.tracker.memberId === who.memberId ? (
                <>
                  Đã chỉ định <b>{who.fullName}</b> ({plan.origin.name}) phụ trách hiện trường: chờ khởi hành.
                </>
              ) : accepted && plan.tracker ? (
                <>
                  <b>{who.fullName}</b> ({plan.origin.name}) đã nhận ca, chọn <b>{plan.tracker.fullName}</b>{' '}
                  đi hiện trường: chờ khởi hành.
                </>
              ) : accepted ? (
                <>
                  <b>{who.fullName}</b> ({plan.origin.name}) đã nhận ca, đang chọn người đi hiện trường.
                </>
              ) : (
                <>
                  Đã gửi thông tin ca cho <b>{who.fullName}</b> ({plan.origin.name}). Đang chờ chấp nhận...
                </>
              )}
            </div>
            {who.phone && (
              <div>
                Liên hệ trực tiếp: <a href={`tel:${who.phone}`}>{who.phone}</a>
              </div>
            )}
          </div>
        </div>
        {!accepted && (
          <WithdrawControl
            incidentId={incidentId}
            name={who.fullName}
            onPlan={onPlan}
            onChange={!locked ? () => setChanging(true) : null}
          />
        )}
      </div>
    );
  }
  return (
    <Candidates
      incidentId={incidentId}
      plan={plan}
      onDone={(next) => {
        setChanging(false);
        onPlan(next);
      }}
    />
  );
}

function Candidates({ incidentId, plan, onDone }) {
  const toast = useToast();
  // PCCC / CSGT: the appointed officer is also the field officer (GPS), no "Chấp nhận"; then "Khởi hành"
  const appoints = plan.origin.agency === 'fire' || plan.origin.agency === 'csgt';
  const [list, setList] = useState({ status: 'loading', items: [], error: null });
  const [busyId, setBusyId] = useState(null);
  const [reload, setReload] = useState(0); // "Làm mới": online / busy change while the officer decides
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    getDelegationCandidates(incidentId)
      .then((items) => alive && setList({ status: 'ready', items, error: null }))
      .catch((err) => alive && setList((l) => ({ ...l, status: 'error', error: err.message })))
      .finally(() => alive && setRefreshing(false));
    return () => {
      alive = false;
    };
  }, [incidentId, reload]);

  const contact = async (o) => {
    setBusyId(o.memberId);
    try {
      const next = await delegateDispatch(incidentId, o.memberId);
      toast.show(
        appoints
          ? `Đã chỉ định ${o.fullName} phụ trách hiện trường: gửi link rồi bấm "Khởi hành"`
          : `Đã chuyển thông tin ca cho ${o.fullName}`,
        { tone: 'success' },
      );
      onDone(next);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const online = list.items.filter((o) => o.online).length;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          Cán bộ {plan.origin.name} · {list.items.length} người, {online} trực tuyến
        </div>
        <button
          type="button"
          className={styles.refresh}
          disabled={refreshing}
          title="Tải lại trạng thái trực tuyến / đang trong ca"
          onClick={() => {
            setRefreshing(true);
            setReload((n) => n + 1);
          }}
        >
          {refreshing ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>
      {list.status === 'loading' && <div className={styles.meta}>Đang tải...</div>}
      {list.status === 'error' && <div className={styles.error}>Không tải được danh sách: {list.error}</div>}
      {list.status === 'ready' && list.items.length === 0 && (
        <div className={styles.meta}>
          Đơn vị này chưa có tài khoản cán bộ trên hệ thống. Quay lại bước trước để chọn cơ sở khác.
        </div>
      )}
      <ul className={styles.officers}>
        {list.items.map((o) => (
          <li key={o.memberId} className={`${styles.officer} ${o.online ? '' : styles.offline}`}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(o.fullName)}
              <i className={o.online ? styles.dotOn : styles.dotOff} />
            </span>
            <div className={styles.officerMain}>
              <div className={styles.officerName}>
                {o.fullName}{' '}
                <span className={o.online ? styles.chipOn : styles.chipOff}>
                  {o.online ? 'Trực tuyến' : 'Ngoại tuyến'}
                </span>{' '}
                {o.busy && (
                  <span className={styles.chipBusy}>
                    {o.delegatedElsewhere ? 'Được uỷ quyền ca' : 'Đang giữ ca'} {o.heldIncidentId}
                  </span>
                )}
              </div>
              <div className={styles.officerSub}>
                {o.phone ? <a href={`tel:${o.phone}`}>{o.phone}</a> : 'Chưa có SĐT'} · {o.email}
              </div>
            </div>
            <button
              type="button"
              className={styles.contact}
              disabled={!!busyId || o.busy}
              title={
                o.busy
                  ? 'Cán bộ đang trong ca khác, không giao được'
                  : o.online
                    ? 'Gửi thông tin ca cho cán bộ này'
                    : 'Cán bộ đang ngoại tuyến: sẽ thấy ca khi mở bàn chỉ huy'
              }
              onClick={() => contact(o)}
            >
              {busyId === o.memberId
                ? 'Đang gửi...'
                : o.busy
                  ? 'Đang trong ca'
                  : appoints
                    ? 'Chỉ định'
                    : 'Lập tức liên hệ'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'CB';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/** "Thu hồi uỷ quyền": the officer did not answer / cannot be reached -> back to choosing (asks first). */
function WithdrawControl({ incidentId, name, onPlan, onChange }) {
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const withdraw = async () => {
    setBusy(true);
    try {
      onPlan(await withdrawDelegation(incidentId));
      toast.show(`Đã thu hồi uỷ quyền của ${name}: chọn lại người nhận hoặc đổi điều động`, {
        tone: 'success',
      });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };
  if (asking) {
    return (
      <div className={styles.withdrawBox}>
        <span>
          Thu hồi uỷ quyền đã gửi cho <b>{name}</b>? Ca sẽ biến khỏi hàng đợi của đơn vị đó.
        </span>
        <div className={styles.row}>
          <button type="button" className={styles.ghost} disabled={busy} onClick={() => setAsking(false)}>
            Không
          </button>
          <button type="button" className={styles.reject} disabled={busy} onClick={withdraw}>
            {busy ? 'Đang thu hồi...' : 'Thu hồi'}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.row}>
      {onChange && (
        <button type="button" className={styles.ghost} onClick={onChange}>
          Đổi người nhận
        </button>
      )}
      <button
        type="button"
        className={styles.reject}
        title="Người nhận không trả lời / không liên lạc được: thu hồi để chọn lại"
        onClick={() => setAsking(true)}
      >
        Thu hồi uỷ quyền
      </button>
    </div>
  );
}
