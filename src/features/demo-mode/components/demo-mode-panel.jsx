import { useEffect, useState } from 'react';

import { SettingsRow, SettingsSection } from '@/components/ui/settings-dialog/settings-dialog';
import { useToast } from '@/components/ui/toast/toast-context';

import { getDemoSettings, updateDemoSettings } from '../api/demo';
import styles from './demo-mode-panel.module.css';

const formatTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : '';

function Switch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`${styles.switch} ${checked ? styles.on : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}

/**
 * "Ca demo" settings section: stop the BE from creating [DEMO] test incidents and hide the existing
 * ones from the queue / history. Shared by every account (the change shows who made it last).
 */
export function DemoModePanel() {
  const notify = useToast().show;
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [speed, setSpeed] = useState('');

  useEffect(() => {
    let alive = true;
    getDemoSettings()
      .then((s) => {
        if (!alive) return;
        setState(s);
        setSpeed(String(s?.simulation_speed_kmh ?? ''));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const change = async (patch) => {
    setBusy(true);
    try {
      const next = await updateDemoSettings(patch);
      setState(next);
      setSpeed(String(next?.simulation_speed_kmh ?? ''));
      notify(
        'simulation_speed_kmh' in patch
          ? `Tốc độ mô phỏng: ${next.simulation_speed_kmh} km/h (áp dụng cho lần bấm Mô phỏng sau).`
          : 'hidden' in patch
          ? patch.hidden
            ? 'Đã ẩn ca demo khỏi hàng đợi và lịch sử.'
            : 'Ca demo hiện lại trong hàng đợi và lịch sử.'
          : patch.generate
            ? 'Đã bật tự sinh ca demo.'
            : 'Đã tắt tự sinh ca demo.',
        { tone: 'success' },
      );
    } catch (e) {
      notify(e.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title="Ca demo">
      {error && <div className={styles.error}>{error}</div>}
      {!state && !error && <div className={styles.muted}>Đang tải…</div>}
      {state && (
        <>
          <SettingsRow
            title="Tự động sinh ca demo"
            desc="Mỗi phút hệ thống tạo ca thử “[DEMO]” cho công an xã / tỉnh và CSGT Cần Thơ để tập nhận ca, điều động."
          >
            <Switch
              label="Tự động sinh ca demo"
              checked={state.generate}
              disabled={busy}
              onChange={(v) => change({ generate: v })}
            />
          </SettingsRow>
          <SettingsRow
            title="Ẩn ca demo"
            desc={`Không hiện các ca “[DEMO]” trong hàng đợi và lịch sử (dữ liệu vẫn giữ). Đang có ${state.open_count} ca demo chưa đóng.`}
          >
            <Switch
              label="Ẩn ca demo"
              checked={state.hidden}
              disabled={busy}
              onChange={(v) => change({ hidden: v })}
            />
          </SettingsRow>
          <SettingsRow
            title="Tốc độ mô phỏng (km/h)"
            desc="Tốc độ xe giả khi bấm “Mô phỏng” trên màn điều động, từ 5 đến 150 km/h. Đang chạy thì bấm Mô phỏng lại để áp dụng."
          >
            <form
              className={styles.speed}
              onSubmit={(e) => {
                e.preventDefault();
                const v = Number(speed);
                if (!Number.isFinite(v) || v < 5 || v > 150) {
                  notify('Tốc độ từ 5 đến 150 km/h.', { tone: 'error' });
                  return;
                }
                change({ simulation_speed_kmh: v });
              }}
            >
              <input
                type="number"
                min={5}
                max={150}
                step={1}
                inputMode="numeric"
                aria-label="Tốc độ mô phỏng (km/h)"
                value={speed}
                disabled={busy}
                onChange={(e) => setSpeed(e.target.value)}
              />
              <button type="submit" disabled={busy || Number(speed) === state.simulation_speed_kmh}>
                Lưu
              </button>
            </form>
          </SettingsRow>
          <div className={styles.muted}>
            Áp dụng ngay cho mọi tài khoản.
            {state.updated_at &&
              ` Đổi lần cuối ${formatTime(state.updated_at)}${state.updated_by_name ? ` bởi ${state.updated_by_name}` : ''}.`}
          </div>
        </>
      )}
    </SettingsSection>
  );
}
