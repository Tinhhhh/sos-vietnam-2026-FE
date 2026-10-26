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
 * Step 4 "Đã xử lý xong": closing needs both sides. The citizen confirms on their tracking screen (the plan is
 * re-read on every queue push); the officer presses "Đã xử lý xong", writes the closing report (result, what was
 * done, forces, note) and can only submit it once the citizen has confirmed -> RESOLVED. Submitting is the
 * officer's confirmation. Citizen unreachable: "Kết thúc ca" (forced) on the queue card.
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
  const citizenOk = !!plan.citizenConfirmedAt;

  const submit = async (e) => {
    e.preventDefault();
    if (!citizenOk || form.summary.trim().length < MIN_SUMMARY) return;
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
      <ul className={styles.checks}>
        <li className={citizenOk ? styles.ok : styles.wait}>
          <span className={styles.mark} aria-hidden="true">
            {citizenOk ? '✓' : ''}
          </span>
          Người báo tin {citizenOk ? 'đã xác nhận đã xử lý xong' : 'chưa xác nhận'}
        </li>
        <li className={styles.wait}>
          <span className={styles.mark} aria-hidden="true" />
          Cán bộ xác nhận khi lập văn bản & kết thúc ca
        </li>
      </ul>
      {!citizenOk && (
        <div className={styles.hint}>
          Ca chỉ kết thúc khi cả người báo tin và cán bộ cùng xác nhận. Không liên lạc được người báo tin thì
          dùng "Kết thúc ca" (bắt buộc) trên thẻ ca.
        </div>
      )}
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
            disabled={busy || !citizenOk || form.summary.trim().length < MIN_SUMMARY}
            title={citizenOk ? undefined : 'Chờ người báo tin xác nhận'}
          >
            {busy ? 'Đang lưu...' : citizenOk ? 'Lập văn bản & kết thúc ca' : 'Chờ người báo tin xác nhận'}
          </button>
        </form>
      )}
    </div>
  );
}
