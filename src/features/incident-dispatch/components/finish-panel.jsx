import { useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { confirmHandled, finishIncident } from '../api/dispatch-api';
import styles from './finish.module.css';

const RESULTS = [
  { value: 'RESOLVED', label: 'Đã xử lý xong' },
  { value: 'FALSE_ALARM', label: 'Báo khống' },
];
const MIN_SUMMARY = 10;

/**
 * Step 4 "Kết thúc": the unit on site and the citizen both confirm the incident is handled, then an officer
 * writes the closing report (result, what was done, forces, note) and the case becomes RESOLVED.
 *
 * @param {{ incidentId: string, plan: object, canConfirm: boolean, onPlan: (plan) => void,
 *           onFinished?: () => void }} props
 *   canConfirm = this officer is the unit on site (own unit, or the assigned officer of a delegated unit)
 */
export function FinishPanel({ incidentId, plan, canConfirm, onPlan, onFinished }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ result: 'RESOLVED', summary: '', forces: '', note: '' });
  const officerOk = !!plan.officerConfirmedAt;
  const citizenOk = !!plan.citizenConfirmedAt;
  const both = officerOk && citizenOk;
  // CHỈ ĐỂ TEST (gỡ cùng DemoIncidentSeeder): mở văn bản ngay, không chờ xác nhận; BE chỉ nhận khi DEMO_INCIDENTS=true
  const [finishNow, setFinishNow] = useState(false);
  const showForm = both || finishNow;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const confirm = async () => {
    setBusy(true);
    try {
      onPlan(await confirmHandled(incidentId));
      toast.show('Đã xác nhận xử lý xong, chờ người báo tin xác nhận', { tone: 'success' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.summary.trim().length < MIN_SUMMARY) return;
    setBusy(true);
    try {
      await finishIncident(incidentId, { ...form, force: false, skipConfirm: !both });
      toast.show(`Đã lập văn bản và kết thúc ca ${incidentId}`, { tone: 'success' });
      onFinished?.();
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Xác nhận đã xử lý xong</div>
      <ul className={styles.checks}>
        <li className={officerOk ? styles.ok : styles.wait}>
          <span className={styles.mark} aria-hidden="true">
            {officerOk ? '✓' : ''}
          </span>
          Đơn vị xử lý ({plan.assignedTo?.fullName || plan.origin.name})
          {officerOk ? ' đã xác nhận' : ' chưa xác nhận'}
        </li>
        <li className={citizenOk ? styles.ok : styles.wait}>
          <span className={styles.mark} aria-hidden="true">
            {citizenOk ? '✓' : ''}
          </span>
          Người báo tin {citizenOk ? 'đã xác nhận' : 'chưa xác nhận'}
        </li>
      </ul>

      {canConfirm && !officerOk && (
        <button type="button" className={styles.primary} disabled={busy} onClick={confirm}>
          {busy ? 'Đang gửi...' : 'Xác nhận đã xử lý xong'}
        </button>
      )}
      {!both && (officerOk || !canConfirm) && (
        <div className={styles.hint}>
          Khi cả đơn vị xử lý và người báo tin cùng xác nhận, văn bản kết thúc ca sẽ mở ra tại đây.
        </div>
      )}
      {!both && !finishNow && (
        <button
          type="button"
          className={styles.testBtn}
          title="Chỉ để test: mở văn bản kết thúc ngay, không chờ xác nhận (BE chỉ cho khi bật DEMO_INCIDENTS)"
          onClick={() => setFinishNow(true)}
        >
          Kết thúc ngay (test)
        </button>
      )}

      {showForm && (
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.title}>Văn bản kết thúc ca</div>
          <div className={styles.radios} role="radiogroup" aria-label="Kết quả">
            {RESULTS.map((r) => (
              <label key={r.value} className={form.result === r.value ? styles.radioOn : styles.radio}>
                <input
                  type="radio"
                  name={`result-${incidentId}`}
                  value={r.value}
                  checked={form.result === r.value}
                  onChange={set('result')}
                />
                {r.label}
              </label>
            ))}
          </div>
          <label className={styles.field}>
            <span>Kết quả xử lý *</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={form.summary}
              placeholder="Diễn biến, việc đã làm tại hiện trường..."
              onChange={set('summary')}
            />
          </label>
          {form.summary.trim().length > 0 && form.summary.trim().length < MIN_SUMMARY && (
            <div className={styles.error}>Ít nhất {MIN_SUMMARY} ký tự</div>
          )}
          <label className={styles.field}>
            <span>Lực lượng, phương tiện tham gia</span>
            <input
              maxLength={500}
              value={form.forces}
              placeholder="Ví dụ: 3 cán bộ, 1 xe"
              onChange={set('forces')}
            />
          </label>
          <label className={styles.field}>
            <span>Ghi chú</span>
            <input maxLength={1000} value={form.note} onChange={set('note')} />
          </label>
          <button
            type="submit"
            className={styles.primary}
            disabled={busy || form.summary.trim().length < MIN_SUMMARY}
          >
            {busy ? 'Đang lưu...' : 'Lập văn bản & kết thúc ca'}
          </button>
        </form>
      )}
    </div>
  );
}
