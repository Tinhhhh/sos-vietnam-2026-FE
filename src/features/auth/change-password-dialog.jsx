import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';

import styles from './account-panels.module.css';
import { changePasswordApi } from './auth-api';

const MIN = 8;
const EMPTY = { current: '', next: '', confirm: '' };

/**
 * "Đổi mật khẩu" for the signed-in account (Settings menu of the officer console).
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function ChangePasswordDialog({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const problem =
    form.next && form.next.length < MIN
      ? `Mật khẩu mới phải từ ${MIN} ký tự`
      : form.confirm && form.confirm !== form.next
        ? 'Nhập lại mật khẩu mới chưa khớp'
        : form.next && form.next === form.current
          ? 'Mật khẩu mới phải khác mật khẩu hiện tại'
          : null;
  const ready = !!form.current && form.next.length >= MIN && form.confirm === form.next && !problem;

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
      await changePasswordApi({ currentPassword: form.current, newPassword: form.next });
      toast.show('Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.', { tone: 'success' });
      setForm(EMPTY);
      onClose();
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
      title={<span className={styles.title}>Đổi mật khẩu</span>}
    >
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span>Mật khẩu hiện tại</span>
          <input type={type} autoComplete="current-password" value={form.current} onChange={set('current')} />
        </label>
        <label className={styles.field}>
          <span>Mật khẩu mới (ít nhất {MIN} ký tự)</span>
          <input type={type} autoComplete="new-password" value={form.next} onChange={set('next')} />
        </label>
        <label className={styles.field}>
          <span>Nhập lại mật khẩu mới</span>
          <input type={type} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Hiện mật khẩu
        </label>
        {(problem || error) && <div className={styles.error}>{error || problem}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={busy} onClick={close}>
            Huỷ
          </button>
          <button type="submit" className={styles.primary} disabled={!ready || busy}>
            {busy ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
