import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';

import styles from './account-panels.module.css';
import { changePinApi } from './auth-api';
import { SESSION_ENDED_KEY } from './auth-context';
import { useAuth } from './use-auth';

const PIN_RE = /^\d{4,6}$/;
const EMPTY = { current: '', next: '', confirm: '' };

/**
 * "Đổi mã PIN" for the signed-in officer (Settings menu). The BE then logs out every session of
 * this officer only (other officers of the unit stay in), so this one goes back to the login page.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function ChangePinDialog({ open, onClose }) {
  const toast = useToast();
  const { logout } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, '') }));
  const problem =
    form.next && !PIN_RE.test(form.next)
      ? 'PIN mới gồm 4–6 chữ số'
      : form.confirm && form.confirm !== form.next
        ? 'Nhập lại PIN mới chưa khớp'
        : form.next && form.next === form.current
          ? 'PIN mới phải khác PIN hiện tại'
          : null;
  const ready = !!form.current && PIN_RE.test(form.next) && form.confirm === form.next && !problem;

  const close = () => {
    if (busy) return;
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await changePinApi({ oldPin: form.current, newPin: form.next });
      toast.show('Đã đổi mã PIN. Vui lòng vào trực lại bằng PIN mới.', { tone: 'success' });
      setForm(EMPTY);
      onClose();
      try {
        sessionStorage.setItem(SESSION_ENDED_KEY, 'Đã đổi mã PIN. Vui lòng vào trực lại bằng PIN mới.');
      } catch {
        // storage blocked: the login page just won't say why
      }
      await logout();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const type = show ? 'text' : 'password';
  return (
    <Modal
      open={open}
      onClose={close}
      solid
      containerStyle={{ maxWidth: 420 }}
      title={<span className={styles.title}>Đổi mã PIN</span>}
    >
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span>PIN hiện tại</span>
          <input
            type={type}
            inputMode="numeric"
            maxLength={6}
            autoComplete="current-password"
            value={form.current}
            onChange={set('current')}
          />
        </label>
        <label className={styles.field}>
          <span>PIN mới (4–6 số)</span>
          <input
            type={type}
            inputMode="numeric"
            maxLength={6}
            autoComplete="new-password"
            value={form.next}
            onChange={set('next')}
          />
        </label>
        <label className={styles.field}>
          <span>Nhập lại PIN mới</span>
          <input
            type={type}
            inputMode="numeric"
            maxLength={6}
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
          />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Hiện PIN
        </label>
        {(problem || error) && <div className={styles.error}>{error || problem}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={busy} onClick={close}>
            Huỷ
          </button>
          <button type="submit" className={styles.primary} disabled={!ready || busy}>
            {busy ? 'Đang đổi...' : 'Đổi PIN'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
