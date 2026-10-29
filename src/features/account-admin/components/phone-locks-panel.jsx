import { useCallback, useEffect, useState } from 'react';

import { SettingsButton, SettingsRow, SettingsSection } from '@/components/ui/settings-dialog/settings-dialog';
import { useToast } from '@/components/ui/toast/toast-context';

import { getActiveLocks, getPhoneLockSettings, liftLock, updatePhoneLockSettings } from '../api/phone-locks';
import styles from './phone-locks-panel.module.css';

const LIFT_NOTE = 'Quản trị viên gỡ khoá';

const formatTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : '';

/**
 * Settings → Quản trị → "Khoá SĐT" (ADMIN): switch the false-report phone lock on / off and lift
 * the 5 most recent locks still in force.
 */
export function PhoneLocksPanel() {
  const notify = useToast().show;
  const [settings, setSettings] = useState(null);
  const [locks, setLocks] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([getPhoneLockSettings(), getActiveLocks(5)])
      .then(([s, l]) => {
        setSettings(s);
        setLocks(l);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const toggle = async (enabled) => {
    setBusy(true);
    try {
      setSettings(await updatePhoneLockSettings(enabled));
      notify(enabled ? 'Đã bật khoá SĐT báo tin giả.' : 'Đã tắt khoá SĐT: không khoá mới, khoá cũ không chặn.', {
        tone: 'success',
      });
    } catch (e) {
      notify(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const lift = async (lock) => {
    const note = window.prompt(`Lý do gỡ khoá ${lock.phone} (ít nhất 5 ký tự):`, LIFT_NOTE);
    if (note == null) return;
    setBusy(true);
    try {
      await liftLock(lock.id, note);
      notify(`Đã gỡ khoá ${lock.phone}.`, { tone: 'success' });
      setLocks(await getActiveLocks(5));
    } catch (e) {
      notify(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title="Khoá SĐT báo tin giả">
      {error && <div className={styles.error}>{error}</div>}
      {!settings && !error && <div className={styles.muted}>Đang tải…</div>}
      {settings && (
        <>
          <SettingsRow
            title="Bật khoá SĐT"
            desc="3 lần báo khống hoặc 4 lần bấm nhầm trong 24 giờ thì khoá 24 giờ, lần khoá thứ 3 trong 30 ngày thì khoá vĩnh viễn. Tắt: không khoá thêm, các khoá đang có tạm không chặn."
          >
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              aria-label="Bật khoá SĐT"
              disabled={busy}
              className={`${styles.switch} ${settings.enabled ? styles.on : ''}`}
              onClick={() => toggle(!settings.enabled)}
            >
              <span className={styles.knob} />
            </button>
          </SettingsRow>
          <div className={styles.subtitle}>5 SĐT bị khoá gần nhất (đang hiệu lực)</div>
          {locks?.length === 0 && <div className={styles.muted}>Không có SĐT nào đang bị khoá.</div>}
          {locks?.map((l) => (
            <SettingsRow
              key={l.id}
              title={l.phone}
              desc={`${l.reason_label} · khoá ${formatTime(l.locked_at)} · ${
                l.permanent ? 'vĩnh viễn' : `tới ${formatTime(l.locked_until)}`
              }`}
            >
              <SettingsButton disabled={busy} onClick={() => lift(l)}>
                Gỡ khoá
              </SettingsButton>
            </SettingsRow>
          ))}
          {settings.updated_at && (
            <div className={styles.muted}>Đổi công tắc lần cuối {formatTime(settings.updated_at)}.</div>
          )}
        </>
      )}
    </SettingsSection>
  );
}
