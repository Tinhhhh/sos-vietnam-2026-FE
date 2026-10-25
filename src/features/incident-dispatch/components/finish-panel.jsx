import { useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { finishIncident } from '../api/dispatch-api';
import styles from './finish.module.css';

const RESULTS = [
  { value: 'RESOLVED', label: 'Đã xử lý xong' },
  { value: 'FALSE_ALARM', label: 'Báo khống' },
];
const MIN_SUMMARY = 10;

/**
 * Step 4 "Đã xử lý xong": one side is enough (25/10/2026). The officer presses it and writes the closing report
 * (result, what was done, forces, note) -> RESOLVED; if the citizen presses it first, the case closes on its own
 * (the queue card goes away) and the report can still be written from the history.
 *
 * @param {{ incidentId: string, plan: object, canConfirm?: boolean, onPlan?: (plan) => void,
 *           onFinished?: () => void }} props
 */
export function FinishPanel({ incidentId, plan, onFinished }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ result: 'RESOLVED', summary: '', forces: '', note: '' });
  const [showForm, setShowForm] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.summary.trim().length < MIN_SUMMARY) return;
    setBusy(true);
    try {
      await finishIncident(incidentId, { ...form, force: false });
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
      <div className={styles.title}>Lực lượng đã tới hiện trường</div>
      <div className={styles.hint}>
        {plan.citizenConfirmedAt
          ? 'Người báo tin đã xác nhận sự việc được xử lý xong.'
          : 'Xử lý xong thì bấm "Đã xử lý xong" (cán bộ hoặc người báo tin bấm là đủ).'}
      </div>
      {!showForm && (
        <button type="button" className={styles.primary} onClick={() => setShowForm(true)}>
          Đã xử lý xong
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
