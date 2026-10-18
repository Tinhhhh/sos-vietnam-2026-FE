import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import { useVnClock } from '../hooks/use-vn-clock';
import { useWeather } from '../hooks/use-weather';
import ui from './console-header.module.css';
import styles from './officer-header.module.css';

/**
 * Officer console header (flat bar, national dispatch design): crest + system title on the left;
 * VN clock, weather, unit location, incident bell (pending count, opens the queue window) and
 * the signed-in officer on the right. Settings / logout live in the console's left rail (SettingsMenu).
 *
 * @param {{
 *   officer: ReturnType<import('@/features/auth').buildOfficerProfile>,
 *   unitCoords?: { lat: number, lng: number } | null,
 *   onLocateUnit?: () => void,
 *   onOpenOfficerInfo?: () => void,
 *   pendingCount?: number,
 *   onOpenQueue?: () => void,
 * }} props
 */
export function OfficerHeader({
  officer,
  unitCoords,
  onLocateUnit,
  onOpenOfficerInfo,
  pendingCount = 0,
  onOpenQueue,
}) {
  const clock = useVnClock();
  const weather = useWeather(unitCoords);
  const bellLabel = pendingCount > 0 ? `${pendingCount} ca đang chờ tiếp nhận` : 'Hàng đợi sự cố';

  return (
    <header className={ui.bar}>
      <div className={ui.brand}>
        <img src="/assets/icons/khien.png" className={ui.crest} alt="Huy hiệu Công an nhân dân" />
        <div className={ui.titles}>
          <div className={ui.title}>Hệ Thống Điều Phối Khẩn Cấp Quốc Gia 24/7</div>
          <div className={ui.subtitle}>Vietnam National Emergency Dispatch System</div>
        </div>
      </div>

      <div className={ui.right}>
        <div className={`${ui.info} ${ui.clock}`}>
          <SvgIcon name="clock" color="blue" />
          <span className={ui.infoText}>
            <span className={ui.infoMain}>{clock.time} (VN)</span>
            <span className={ui.infoSub}>{clock.date}</span>
          </span>
        </div>

        <WeatherInfo weather={weather} />

        <button
          type="button"
          className={`${ui.info} ${ui.unit}`}
          title="Đơn vị công tác (bấm để xem trên bản đồ)"
          onClick={onLocateUnit}
        >
          <SvgIcon name="pin" color="amber" />
          <span className={ui.infoText}>
            <span className={ui.infoMain}>
              {officer.unitName}
              <i className={ui.liveDot} aria-hidden="true" />
            </span>
            <span className={ui.infoSub}>{officer.unitSub}</span>
          </span>
        </button>

        <button
          type="button"
          className={ui.iconBtn}
          title={bellLabel}
          aria-label={bellLabel}
          onClick={onOpenQueue}
        >
          <SvgIcon name="bell" size="sm" />
          {pendingCount > 0 && <em className={ui.badge}>{pendingCount > 99 ? '99+' : pendingCount}</em>}
        </button>

        <button
          type="button"
          className={ui.profile}
          title="Cán bộ đang đăng nhập (bấm để xem hồ sơ)"
          onClick={onOpenOfficerInfo}
        >
          <span className={ui.avatar} aria-hidden="true">
            {initials(officer.fullName)}
          </span>
          <span className={ui.profileText}>
            <span className={ui.infoMain}>{officer.fullName}</span>
            <span className={ui.infoSub}>
              {officer.isAdmin ? 'Quản trị hệ thống' : 'Cán bộ · Đang trực tuyến'}
            </span>
          </span>
          <i className={ui.chevron} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

/** "Nguyễn Văn An" -> "NA" (first letter of the first and last word). */
function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CB';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function WeatherInfo({ weather }) {
  const w = weather.weather;
  const isNight = w ? !w.is_day : true;
  let primary = '--°C';
  let secondary = 'Đang cập nhật...';
  if (weather.status === 'ready' && w) {
    primary = `${Math.round(w.temperature)}°C`;
    secondary = w.description || 'Thời tiết ổn định';
  } else if (weather.status === 'unavailable') {
    secondary = 'Chưa có dữ liệu';
  }

  return (
    <button
      type="button"
      className={`${ui.info} ${ui.weather}`}
      title="Thời tiết tại đơn vị (bấm để làm mới)"
      onClick={weather.refresh}
    >
      <SvgIcon name={isNight ? 'moon' : 'sun'} color={isNight ? 'purple' : 'amber'} />
      <span className={ui.infoText}>
        <span className={ui.infoMain}>{primary}</span>
        <span className={ui.infoSub}>{secondary}</span>
      </span>
    </button>
  );
}

/**
 * Settings popover (admin tools, officer profile, logout). The trigger is supplied by the caller
 * (the console rail button): renderTrigger({ ref, onClick, open }). The menu opens to the right
 * of the trigger, or below it on narrow screens.
 */
export function SettingsMenu({ isAdmin, onOpenAdmin, onOpenOfficerInfo, onLogout, renderTrigger }) {
  const [pos, setPos] = useState(null); // null = closed
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setPos(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [pos]);

  const toggle = () => {
    if (pos) {
      setPos(null);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    const menuHeight = 260;
    if (window.innerWidth <= 992) {
      // rail is at the bottom on phones: open above the button
      setPos({
        bottom: window.innerHeight - rect.top + 10,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
      });
    } else {
      setPos({
        top: Math.max(8, Math.min(rect.top, window.innerHeight - menuHeight - 8)),
        left: rect.right + 10,
      });
    }
  };

  const pick = (fn) => () => {
    setPos(null);
    fn?.();
  };

  return (
    <>
      {renderTrigger({ ref: btnRef, onClick: toggle, open: !!pos })}

      {pos &&
        createPortal(
          <div
            ref={menuRef}
            className={`${styles.gearDropdownMenu} liquid-glass`}
            style={{
              display: 'flex',
              position: 'fixed',
              zIndex: 99999,
              top: pos.top ?? 'auto',
              bottom: pos.bottom ?? 'auto',
              left: pos.left,
              right: 'auto',
            }}
          >
            {isAdmin && (
              <div
                className={styles.gearMenuItem}
                title="Bảng phân quyền & quản trị hệ thống"
                onClick={pick(onOpenAdmin)}
              >
                <div
                  className={styles.gearMenuIcon}
                  style={{
                    background: 'rgba(139, 92, 246, 0.25)',
                    color: '#c084fc',
                    border: '1px solid rgba(139, 92, 246, 0.5)',
                  }}
                >
                  <SvgIcon name="shield" color="purple" />
                </div>
                <div className={styles.gearMenuContent}>
                  <div className={styles.gearMenuTitle} style={{ color: '#c084fc' }}>
                    Phân Quyền & Quản Trị
                  </div>
                  <div className={styles.gearMenuDesc}>Tài khoản đơn vị, mật khẩu, ủy quyền</div>
                </div>
              </div>
            )}

            <div className={styles.gearMenuItem} title="Hồ sơ cán bộ" onClick={pick(onOpenOfficerInfo)}>
              <div
                className={styles.gearMenuIcon}
                style={{
                  background: 'rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                }}
              >
                <SvgIcon name="user" color="blue" />
              </div>
              <div className={styles.gearMenuContent}>
                <div className={styles.gearMenuTitle} style={{ color: '#38bdf8' }}>
                  Thông Tin Cán Bộ
                </div>
                <div className={styles.gearMenuDesc}>Hồ sơ cán bộ, đơn vị công tác</div>
              </div>
            </div>

            <div className={styles.gearMenuDivider} />

            <div className={styles.gearMenuItem} title="Đăng xuất" onClick={pick(onLogout)}>
              <div
                className={styles.gearMenuIcon}
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                }}
              >
                <SvgIcon name="logout" color="red" />
              </div>
              <div className={styles.gearMenuContent}>
                <div className={styles.gearMenuTitle} style={{ color: '#f87171' }}>
                  Đăng Xuất
                </div>
                <div className={styles.gearMenuDesc}>Thoát phiên làm việc an ninh</div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
