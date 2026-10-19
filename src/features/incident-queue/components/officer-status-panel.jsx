import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { getOfficerStatus, releaseIncident } from '../api/incidents';
import styles from './officer-status.module.css';

const MIN_REASON = 5;
const REFRESH_MS = 15000;

/**
 * Window "Cán bộ": officers of my unit with their status (online = command console open,
 * busy = holding a case) and basic info. While I hold a case I can hand it over to a colleague
 * who is online and free (reason required, like the handover dialog).
 *
 * @param {{ holding?: object|null, onChange?: (incident) => void }} props
 *   holding = the case I hold (from the live queue), onChange = apply the handed-over case to the queue.
 */
export function OfficerStatusPanel({ holding, onChange }) {
  const toast = useToast();
  const [result, setResult] = useState({ status: 'loading', items: [], error: null });
  const [tick, setTick] = useState(0);
  const [handoverTo, setHandoverTo] = useState(null); // accountId with the reason box open
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getOfficerStatus()
      .then((items) => alive && setResult({ status: 'ready', items, error: null }))
      .catch((err) => alive && setResult((r) => ({ ...r, status: 'error', error: err.message })));
    const t = setTimeout(() => setTick((n) => n + 1), REFRESH_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [tick]);

  const onlineCount = result.items.filter((o) => o.online).length;
  const canHandOver = holding && holding.heldByMe;

  const confirm = async (officer) => {
    if (note.trim().length < MIN_REASON) return;
    setBusy(true);
    try {
      const updated = await releaseIncident(holding.id, {
        toAccountId: officer.accountId,
        note: note.trim(),
      });
      if (updated) onChange?.(updated);
      toast.show(`Đã giao ca ${holding.id} cho ${officer.fullName}`, { tone: 'success' });
      setHandoverTo(null);
      setNote('');
      setTick((n) => n + 1);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        <span>
          {result.items.length} cán bộ · <b className={styles.onlineText}>{onlineCount} trực tuyến</b>
        </span>
        <button type="button" className={styles.refresh} onClick={() => setTick((n) => n + 1)}>
          Làm mới
        </button>
      </div>
      {canHandOver && (
        <div className={styles.holding}>
          Bạn đang giữ ca <b>{holding.id}</b>. Chọn cán bộ đang trực tuyến và rảnh để giao ca.
        </div>
      )}

      <div className={styles.list}>
        {result.status === 'loading' && result.items.length === 0 && (
          <div className={styles.note}>Đang tải...</div>
        )}
        {result.status === 'error' && (
          <div className={styles.error}>Không tải được danh sách: {result.error}</div>
        )}
        {result.status === 'ready' && result.items.length === 0 && (
          <div className={styles.note}>Đơn vị chưa có tài khoản cán bộ nào khác.</div>
        )}
        {result.items.map((o) => {
          const canTake = canHandOver && !o.isMe && o.online && !o.busy;
          const open = handoverTo === o.accountId;
          return (
            <div key={o.accountId} className={`${styles.row} ${o.online ? '' : styles.offline}`}>
              <div className={styles.rowMain}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(o.fullName)}
                  <i className={o.online ? styles.dotOn : styles.dotOff} />
                </span>
                <div className={styles.info}>
                  <div className={styles.name}>
                    {o.fullName}
                    {o.isMe && <span className={styles.me}>Bạn</span>}
                  </div>
                  <div className={styles.sub}>
                    {[o.unitLabel, o.ward || o.province].filter(Boolean).join(' · ')}
                  </div>
                  <div className={styles.sub}>
                    {o.phone ? <a href={`tel:${o.phone}`}>{o.phone}</a> : 'Chưa có SĐT'} · {o.email}
                  </div>
                </div>
                <div className={styles.state}>
                  <span className={o.online ? styles.chipOn : styles.chipOff}>
                    {o.online ? 'Trực tuyến' : 'Ngoại tuyến'}
                  </span>
                  {o.heldIncident ? (
                    <span className={styles.chipBusy} title={o.heldIncident.statusLabel}>
                      Giữ ca {o.heldIncident.id}
                    </span>
                  ) : (
                    o.online && <span className={styles.chipFree}>Đang rảnh</span>
                  )}
                </div>
              </div>
              {canTake && !open && (
                <button
                  type="button"
                  className={styles.handoverBtn}
                  onClick={() => {
                    setHandoverTo(o.accountId);
                    setNote('');
                  }}
                >
                  Giao ca {holding.id} cho cán bộ này
                </button>
              )}
              {open && (
                <div className={styles.handoverBox}>
                  <label className={styles.reasonLabel} htmlFor={`reason-${o.accountId}`}>
                    Lý do giao ca *
                  </label>
                  <textarea
                    id={`reason-${o.accountId}`}
                    className={styles.reason}
                    rows={2}
                    maxLength={255}
                    value={note}
                    placeholder="Ví dụ: hết ca trực, chuyển cho đồng chí trực đêm"
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {note.trim().length > 0 && note.trim().length < MIN_REASON && (
                    <div className={styles.reasonError}>Lý do ít nhất {MIN_REASON} ký tự</div>
                  )}
                  <div className={styles.handoverActions}>
                    <button type="button" className={styles.cancel} onClick={() => setHandoverTo(null)}>
                      Huỷ
                    </button>
                    <button
                      type="button"
                      className={styles.confirm}
                      disabled={busy || note.trim().length < MIN_REASON}
                      onClick={() => confirm(o)}
                    >
                      {busy ? 'Đang giao...' : 'Xác nhận giao ca'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'CB';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}
