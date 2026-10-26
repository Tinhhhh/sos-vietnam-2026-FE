import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { changeFieldMember, getFieldCandidates } from '../api/dispatch-api';
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

/** Collapsed: only the picked officer (the whole list while nobody / nobody known is picked). */
function shown(list, value, collapsed) {
  if (!collapsed || !value) return list;
  const picked = list.filter((o) => o.memberId === value);
  return picked.length ? picked : list;
}

/**
 * Step 3 (on the way): shows the field officer and lets the receiving officer swap them
 * (wrong person picked, phone handed over). The live GPS follows the new badge right away.
 */
export function FieldOfficerChange({ incidentId, plan, onPlan }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const current = plan.tracker;

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

  return (
    <div className={styles.change} onClick={(e) => e.stopPropagation()}>
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
