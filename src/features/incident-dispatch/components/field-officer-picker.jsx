import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { changeFieldMember, getFieldCandidates } from '../api/dispatch-api';
import { initials } from '../utils/initials';
import list from './delegation.module.css';
import styles from './field-officer.module.css';

/**
 * "Người phụ trách hiện trường": the receiving officer of the unit that goes picks one officer of their
 * own unit who goes out and carries the GPS phone (Traccar, badge number = device id). Online is only
 * shown as information: officers may be out doing other work. Officers without a badge or already on
 * another open trip cannot be picked (the BE refuses them too).
 *
 * @param {{ incidentId: string, value: string|null, onChange: (memberId: string) => void, compact?: boolean,
 *           collapsible?: boolean }} props  collapsible: once someone is picked (at "Yêu cầu điều động") only
 *   that person shows, with "Đổi người" to open the whole list again
 */
export function FieldOfficerPicker({ incidentId, value, onChange, compact = false, collapsible = false }) {
  const [state, setState] = useState({ status: 'loading', list: [], error: null });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    getFieldCandidates(incidentId)
      .then((list) => alive && setState({ status: 'ready', list, error: null }))
      .catch((err) => alive && setState({ status: 'error', list: [], error: err.message }));
    return () => {
      alive = false;
    };
  }, [incidentId]);

  return (
    <div className={`${styles.box} ${compact ? styles.compact : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className={styles.head}>
        <span className={styles.title}>Người phụ trách hiện trường *</span>
        <span className={styles.hint}>Cầm điện thoại GPS, người dân thấy và gọi được</span>
      </div>
      {state.status === 'loading' && <div className={styles.muted}>Đang tải cán bộ của đơn vị...</div>}
      {state.status === 'error' && <div className={styles.error}>{state.error}</div>}
      {state.status === 'ready' && state.list.length === 0 && (
        <div className={styles.muted}>Đơn vị chưa có cán bộ nào.</div>
      )}
      <div className={styles.list} role="radiogroup" aria-label="Người phụ trách hiện trường">
        {shown(state.list, value, collapsible && !expanded).map((o) => (
          <button
            key={o.memberId}
            type="button"
            role="radio"
            aria-checked={value === o.memberId}
            disabled={!o.selectable}
            className={`${styles.item} ${value === o.memberId ? styles.selected : ''}`}
            onClick={() => onChange(o.memberId, o)}
            title={o.unavailableReason || undefined}
          >
            <span className={styles.radio} aria-hidden="true" />
            <span className={styles.main}>
              <span className={styles.name}>
                {o.fullName}
                {o.me && <span className={styles.tag}>Bạn</span>}
                {o.commander && <span className={styles.tag}>Chỉ huy</span>}
              </span>
              <span className={styles.sub}>
                {o.selectable
                  ? [o.badgeNumber && `Số hiệu ${o.badgeNumber}`, o.position].filter(Boolean).join(' · ')
                  : o.unavailableReason}
              </span>
            </span>
            <span
              className={`${styles.dot} ${o.online ? styles.online : ''}`}
              title={o.online ? 'Đang trực tuyến' : 'Ngoại tuyến'}
            />
          </button>
        ))}
      </div>
      {collapsible && !expanded && value && state.status === 'ready' && (
        <button type="button" className={styles.linkBtn} onClick={() => setExpanded(true)}>
          Đổi người
        </button>
      )}
    </div>
  );
}

/** Who can be sent first (online before offline), the ones that cannot be picked last; order kept otherwise. */
function sortCandidates(items) {
  const rank = (o) => (o.selectable ? 0 : 2) + (o.online ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/**
 * Officers of my unit as a list like the "Uỷ quyền" step (avatar, online, phone): "Chọn đi hiện trường" saves
 * that person as the field officer right away (the delegated ward officer's window, before "Khởi hành").
 *
 * @param {{ incidentId: string, unitName: string, onPlan: (plan) => void }} props
 */
export function FieldOfficerList({ incidentId, unitName, onPlan }) {
  const toast = useToast();
  const [state, setState] = useState({ status: 'loading', items: [], error: null });
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    getFieldCandidates(incidentId)
      .then((items) => alive && setState({ status: 'ready', items, error: null }))
      .catch((err) => alive && setState((s) => ({ ...s, status: 'error', error: err.message })))
      .finally(() => alive && setRefreshing(false));
    return () => {
      alive = false;
    };
  }, [incidentId, reload]);

  const pick = async (o) => {
    setBusyId(o.memberId);
    try {
      onPlan?.(await changeFieldMember(incidentId, o.memberId));
      toast.show(`${o.fullName} đi hiện trường: gửi link rồi bấm "Khởi hành"`, { tone: 'success' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const online = state.items.filter((o) => o.online).length;
  return (
    <div className={list.card}>
      <div className={list.cardHead}>
        <div className={list.cardTitle}>
          Chọn người đi hiện trường · {unitName} · {state.items.length} người, {online} trực tuyến
        </div>
        <button
          type="button"
          className={list.refresh}
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            setReload((n) => n + 1);
          }}
        >
          {refreshing ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>
      <div className={list.meta}>
        Người đi cầm điện thoại GPS (số hiệu = mã thiết bị), người dân thấy và gọi được.
      </div>
      {state.status === 'loading' && <div className={list.meta}>Đang tải...</div>}
      {state.status === 'error' && <div className={list.error}>Không tải được danh sách: {state.error}</div>}
      <ul className={list.officers}>
        {sortCandidates(state.items).map((o) => (
          <li key={o.memberId} className={`${list.officer} ${o.selectable ? '' : list.offline}`}>
            <span className={list.avatar} aria-hidden="true">
              {initials(o.fullName)}
              <i className={o.online ? list.dotOn : list.dotOff} />
            </span>
            <div className={list.officerMain}>
              <div className={list.officerName}>
                {o.fullName}{' '}
                <span className={o.online ? list.chipOn : list.chipOff}>
                  {o.online ? 'Trực tuyến' : 'Ngoại tuyến'}
                </span>
                {o.me && <span className={list.chipOff}> Bạn</span>}
              </div>
              <div className={list.officerSub}>
                {o.selectable
                  ? [o.badgeNumber && `Số hiệu ${o.badgeNumber}`, o.position].filter(Boolean).join(' · ')
                  : o.unavailableReason}
                {o.phone && (
                  <>
                    {' · '}
                    <a href={`tel:${o.phone}`}>{o.phone}</a>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              className={list.contact}
              disabled={!!busyId || !o.selectable}
              title={o.unavailableReason || 'Người này cầm điện thoại GPS đi hiện trường'}
              onClick={() => pick(o)}
            >
              {busyId === o.memberId
                ? 'Đang lưu...'
                : o.selectable
                  ? 'Chọn đi hiện trường'
                  : 'Không chọn được'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Collapsed: only the picked officer (the whole list while nobody / nobody known is picked). */
function shown(list, value, collapsed) {
  if (!collapsed || !value) return list;
  const picked = list.filter((o) => o.memberId === value);
  return picked.length ? picked : list;
}

/**
 * Step 3 (on the way): shows the field officer and lets the receiving officer swap them
 * (wrong person picked, phone handed over). The live GPS follows the new badge right away.
 * With `open` given the caller owns the trigger (the dispatch window puts "Đổi người" next to "Gọi"):
 * only the list shows, and only while open (mount it when opening: the current officer is preselected).
 */
export function FieldOfficerChange({ incidentId, plan, onPlan, open: openProp, onClose }) {
  const toast = useToast();
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const setOpen = (v) => (controlled ? !v && onClose?.() : setOpenState(v));
  const current = plan.tracker;
  const [picked, setPicked] = useState(controlled ? current?.memberId || null : null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);

  // opened from a button higher up (next to "Gọi"): bring the list into view
  useEffect(() => {
    if (controlled) boxRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [controlled]);

  const save = async () => {
    setBusy(true);
    try {
      const next = await changeFieldMember(incidentId, picked);
      onPlan?.(next);
      setOpen(false);
      toast.show(`Người phụ trách hiện trường: ${next?.tracker?.fullName || ''}`, { tone: 'success' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (controlled && !open) return null;

  return (
    <div ref={boxRef} className={styles.change} onClick={(e) => e.stopPropagation()}>
      {!open ? (
        <div className={styles.changeRow}>
          <span className={styles.sub}>
            Phụ trách hiện trường: <b>{current ? current.fullName : 'chưa chọn'}</b>
          </span>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setPicked(current?.memberId || null);
              setOpen(true);
            }}
          >
            Đổi người
          </button>
        </div>
      ) : (
        <>
          <FieldOfficerPicker incidentId={incidentId} value={picked} onChange={setPicked} compact />
          <div className={styles.changeRow}>
            <button type="button" className={styles.ghost} disabled={busy} onClick={() => setOpen(false)}>
              Huỷ
            </button>
            <button
              type="button"
              className={styles.save}
              disabled={busy || !picked || picked === current?.memberId}
              onClick={save}
            >
              {busy ? 'Đang lưu...' : 'Lưu người phụ trách'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
