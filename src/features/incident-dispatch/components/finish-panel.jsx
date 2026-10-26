import { useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { finishIncident, getDispatchPlan } from '../api/dispatch-api';
import styles from './finish.module.css';

const RESULTS = [
  { value: 'RESOLVED', label: 'Đã xử lý xong' },
  { value: 'FALSE_ALARM', label: 'Báo khống' },
];
const MIN_SUMMARY = 10;

/**
 * Step 4 "Kết thúc":
 * - "Đã xử lý xong" needs both sides, in any order: the citizen confirms on their tracking screen, the officer
 *   writes the closing report here (that is the officer's confirmation). The case closes when both have confirmed.
 * - "Báo khống": the officer closes the case at once (report required).
 * - "Đây là ca test": closes at once, nothing to write.
 * Citizen unreachable on a real case: "Kết thúc ca" (forced) on the queue card.
 *
 * @param {{ incidentId: string, plan: object, canConfirm?: boolean, onPlan?: (plan) => void,
 *           onFinished?: () => void }} props
 */
export function FinishPanel({ incidentId, plan, onPlan, onFinished }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ result: 'RESOLVED', summary: '', forces: '', note: '' });
  const [showForm, setShowForm] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const citizenOk = !!plan.citizenConfirmedAt;
  const officerOk = !!plan.officerConfirmedAt;
  const falseAlarm = form.result === 'FALSE_ALARM';

  const send = async (payload, closedMessage) => {
    setBusy(true);
    try {
      await finishIncident(incidentId, { ...payload, force: false });
      // "Đã xử lý xong" before the citizen confirmed: recorded, the case stays open until they confirm
      const waiting = payload.result === 'RESOLVED' && !citizenOk;
      if (waiting) {
        toast.show('Đã ghi xác nhận của cán bộ: ca kết thúc khi người báo tin xác nhận', { tone: 'success' });
        const next = await getDispatchPlan(incidentId).catch(() => null);
        if (next) onPlan?.(next);
        setShowForm(false);
      } else {
        toast.show(closedMessage, { tone: 'success' });
        onFinished?.();
      }
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (form.summary.trim().length < MIN_SUMMARY) return;
    send(
      form,
      falseAlarm ? `Đã kết thúc ca ${incidentId} (báo khống)` : `Đã lập văn bản và kết thúc ca ${incidentId}`,
    );
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
        <li className={officerOk ? styles.ok : styles.wait}>
          <span className={styles.mark} aria-hidden="true">
            {officerOk ? '✓' : ''}
          </span>
          Cán bộ {officerOk ? 'đã xác nhận (đã lập văn bản)' : 'xác nhận khi lập văn bản'}
        </li>
      </ul>
      <div className={styles.hint}>
        Ca thật kết thúc khi cả người báo tin và cán bộ cùng xác nhận (bên nào trước cũng được). Báo khống thì
        kết thúc ngay. Không liên lạc được người báo tin thì dùng "Kết thúc ca" (bắt buộc) trên thẻ ca.
      </div>

      {officerOk && !citizenOk ? (
        <div className={styles.hint}>Đã lập văn bản. Đang chờ người báo tin xác nhận để kết thúc ca...</div>
      ) : (
        !showForm && (
          <button type="button" className={styles.primary} onClick={() => setShowForm(true)}>
            Đã xử lý xong / Báo khống
          </button>
        )
      )}

      {showForm && !(officerOk && !citizenOk) && (
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
              placeholder={
                falseAlarm ? 'Vì sao xác định là báo khống...' : 'Diễn biến, việc đã làm tại hiện trường...'
              }
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
            {busy
              ? 'Đang lưu...'
              : falseAlarm
                ? 'Kết thúc ca (báo khống)'
                : citizenOk
                  ? 'Xác nhận & kết thúc ca'
                  : 'Xác nhận đã xử lý xong'}
          </button>
        </form>
      )}

      <button
        type="button"
        className={styles.testBtn}
        disabled={busy}
        title="Ca thử nghiệm: kết thúc ngay, không cần viết văn bản"
        onClick={() =>
          send({ result: 'TEST', summary: '', forces: '', note: '' }, `Đã kết thúc ca test ${incidentId}`)
        }
      >
        Đây là ca test – kết thúc ngay
      </button>
    </div>
  );
}
