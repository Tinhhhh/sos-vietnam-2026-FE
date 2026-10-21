import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import { formatCodeInput, lookupIncident } from '../api/lookup';
import styles from './incident-lookup-modal.module.css';

const TIME = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const fmt = (v) => (v ? TIME.format(new Date(v)) : null);

/**
 * Citizen re-reads the rescue record of a finished incident with its lookup code + last 4 phone digits.
 * documentSlot: "Xem & ký văn bản báo cáo" of the report feature (composed by the route), given
 * { lookupCode, phoneLast4 }.
 */
export function IncidentLookupModal({ open, onClose, documentSlot }) {
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
        <LookupResult
          data={result}
          onBack={() => setResult(null)}
          document={
            result.status === 'RESOLVED' && documentSlot
              ? documentSlot({ lookupCode: code, phoneLast4: last4 })
              : null
          }
        />
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

const km = (m) => (m == null ? null : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
const mins = (s) => (s == null ? null : `~${Math.max(1, Math.round(s / 60))} phút`);
const join = (...parts) => parts.filter(Boolean).join(' · ') || null;
const person = (o) => (o ? join(o.name, o.unit) : null);

function Section({ title, rows, children }) {
  const shown = (rows || []).filter(([, v]) => v);
  if (!shown.length && !children) return null;
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {shown.length > 0 && (
        <dl className={styles.rows}>
          {shown.map(([k, v]) => (
            <div key={k} className={styles.row}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </section>
  );
}

function LookupResult({ data, onBack, document }) {
  const place = data.full_address || [data.address, data.ward, data.province].filter(Boolean).join(', ');
  const report = data.report;

  return (
    <div className={styles.result}>
      <Section
        title="Thông tin chung"
        rows={[
          ['Mã tra cứu', data.lookup_code],
          ['Tình trạng', data.status_label],
          ['Báo tin lúc', fmt(data.created_at)],
          ['Huỷ lúc', fmt(data.cancelled_at)],
          ['Lý do huỷ', data.cancel_reason_label],
        ]}
      />

      <Section
        title="Người báo tin"
        rows={[
          ['Họ tên', data.citizen_name],
          ['Số điện thoại', data.phone_masked],
        ]}
      />

      <Section
        title="Sự cố"
        rows={[
          ['Loại sự cố', data.emergency_type_label],
          ['Nội dung', data.incident_tags?.length ? data.incident_tags.join(', ') : null],
          ['Mô tả', data.description],
          ['Vị trí báo tin', place || null],
          ['Vị trí lực lượng tới', data.destination_address !== place ? data.destination_address : null],
        ]}
      />

      <Section
        title="Tiếp nhận"
        rows={[
          ['Đơn vị tiếp nhận', data.handling_unit],
          ['Cán bộ nhận ca', person(data.handler)],
          ['Nhận ca lúc', fmt(data.handler?.at || data.accepted_at)],
          ['Chuyển lên tỉnh lúc', fmt(data.escalated_at)],
        ]}
      />

      {data.dispatches?.length > 0 && (
        <Section title="Lực lượng được điều động">
          <ul className={styles.dispatches}>
            {data.dispatches.map((d, i) => (
              <li key={i}>
                <b>{d.station_name}</b>
                <span>{join(d.agency_label, d.role_label, d.phone)}</span>
                {d.status_label && <span className={styles.badge}>{d.status_label}</span>}
                <dl className={styles.rows}>
                  {[
                    ['Điều động bởi', person(d.dispatched_by)],
                    ['Điều động lúc', fmt(d.dispatched_at)],
                    ['Uỷ quyền cho', person(d.assigned_to)],
                    ['Trả lời lúc', d.assigned_to ? fmt(d.assigned_to.at) : null],
                    ['Lý do từ chối', d.reject_reason],
                    ['Xuất phát từ', d.origin_address],
                    ['Điểm đến', d.destination_address],
                    ['Quãng đường', join(km(d.distance_m), mins(d.duration_s))],
                    ['Xuất phát lúc', fmt(d.departed_at)],
                    ['Tới nơi lúc', fmt(d.arrived_at)],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className={styles.row}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report && (
        <Section
          title="Kết quả xử lý"
          rows={[
            ['Kết quả', report.result_label],
            ['Nội dung', report.summary],
            ['Lực lượng tham gia', report.forces],
            ['Ghi chú', report.note],
            ['Kết thúc lúc', fmt(report.created_at)],
          ]}
        />
      )}

      {document}
      <button type="button" className={styles.secondary} onClick={onBack}>
        Tra cứu mã khác
      </button>
    </div>
  );
}
