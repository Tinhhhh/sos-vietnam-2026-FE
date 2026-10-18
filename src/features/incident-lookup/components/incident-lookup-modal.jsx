import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import { formatCodeInput, lookupIncident } from '../api/lookup';
import styles from './incident-lookup-modal.module.css';

const TIME = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const fmt = (v) => (v ? TIME.format(new Date(v)) : null);

/** Citizen re-reads the rescue record of a finished incident with its lookup code + last 4 phone digits. */
export function IncidentLookupModal({ open, onClose }) {
  const [code, setCode] = useState('');
  const [last4, setLast4] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const close = () => {
    setResult(null);
    setError('');
    onClose();
  };

  async function submit(ev) {
    ev.preventDefault();
    if (code.replace('-', '').length !== 8) return setError('Mã tra cứu gồm 8 ký tự, ví dụ K7M2-QX9P');
    if (!/^\d{4}$/.test(last4)) return setError('Nhập đúng 4 số cuối số điện thoại đã dùng khi báo tin');
    setBusy(true);
    setError('');
    try {
      setResult(await lookupIncident(code, last4));
    } catch (err) {
      setError(err.message || 'Không tra cứu được, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      containerStyle={{ maxWidth: 520, maxHeight: '88vh' }}
      titleStyle={{ color: '#38bdf8' }}
      title="TRA CỨU THÔNG TIN CỨU HỘ"
    >
      {result ? (
        <LookupResult data={result} onBack={() => setResult(null)} />
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <p className={styles.hint}>
            Nhập mã tra cứu nhận được khi sự việc xử lý xong và 4 số cuối số điện thoại bạn đã dùng để báo
            tin.
          </p>
          <label className={styles.field}>
            <span>Mã tra cứu</span>
            <input
              className={styles.codeInput}
              value={code}
              onChange={(e) => {
                setCode(formatCodeInput(e.target.value));
                setError('');
              }}
              placeholder="K7M2-QX9P"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className={styles.field}>
            <span>4 số cuối số điện thoại</span>
            <input
              inputMode="numeric"
              value={last4}
              onChange={(e) => {
                setLast4(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              placeholder="5678"
              autoComplete="off"
            />
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.submit} disabled={busy}>
            {busy ? 'Đang tra cứu…' : 'Tra cứu'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function LookupResult({ data, onBack }) {
  const place = [data.address, data.ward, data.province].filter(Boolean).join(', ');
  const rows = [
    ['Mã tra cứu', data.lookup_code],
    ['Loại sự cố', data.emergency_type_label],
    ['Tình trạng', data.status_label],
    ['Nội dung', data.incident_tags?.length ? data.incident_tags.join(', ') : null],
    ['Địa điểm', place || null],
    ['Đơn vị tiếp nhận', data.handling_unit],
    ['Báo tin lúc', fmt(data.created_at)],
    ['Tiếp nhận lúc', fmt(data.accepted_at)],
    ['Chuyển lên tỉnh lúc', fmt(data.escalated_at)],
    ['Huỷ lúc', fmt(data.cancelled_at)],
    ['Lý do huỷ', data.cancel_reason_label],
  ].filter(([, v]) => v);

  return (
    <div className={styles.result}>
      <dl className={styles.rows}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.row}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {data.dispatches?.length > 0 && (
        <div>
          <div className={styles.sectionTitle}>Lực lượng được điều động</div>
          <ul className={styles.dispatches}>
            {data.dispatches.map((d, i) => (
              <li key={i}>
                <b>{d.station_name}</b>
                <span>{[d.agency_label, d.phone, fmt(d.dispatched_at)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className={styles.secondary} onClick={onBack}>
        Tra cứu mã khác
      </button>
    </div>
  );
}
