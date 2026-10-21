import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import { useVnClock } from '../hooks/use-vn-clock';
import { useWeather } from '../hooks/use-weather';
import ui from './console-header.module.css';
import menu from './settings-menu.module.css';

/**
 * Officer console header (flat bar, national dispatch design): crest + system title on the left;
 * VN clock, weather, unit location, incident bell (pending count, opens the queue window) and
 * the signed-in officer on the right. Settings / logout live in the console's left rail (SettingsMenu).
 *
 * @param {{
 *   officer: ReturnType<import('@/features/auth').buildOfficerProfile>,
 *   unitCoords?: { lat: number, lng: number } | null,
 *   onLocateUnit?: () => void,
 *   pendingCount?: number,
 *   onOpenQueue?: () => void,
 * }} props
 */
export function OfficerHeader({ officer, unitCoords, onLocateUnit, pendingCount = 0, onOpenQueue }) {
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

        <div className={ui.profile} title="Cán bộ đang đăng nhập">
          <span className={ui.avatar} aria-hidden="true">
            {initials(officer.fullName)}
          </span>
          <span className={ui.profileText}>
            <span className={ui.infoMain}>{officer.fullName}</span>
            <span className={ui.infoSub}>
              {officer.isAdmin ? 'Quản trị hệ thống' : 'Cán bộ · Đang trực tuyến'}
            </span>
          </span>
        </div>
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
 * Settings popover (admin tools, change password; logout is its own rail button). The trigger is supplied by the caller
 * (the console rail button): renderTrigger({ ref, onClick, open }). The menu opens to the right
 * of the trigger, or below it on narrow screens.
 */
export function SettingsMenu({ isAdmin, onOpenAdmin, onChangePassword, renderTrigger }) {
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
    const menuHeight = 180;
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
            className={menu.menu}
            role="menu"
            style={{ top: pos.top ?? 'auto', bottom: pos.bottom ?? 'auto', left: pos.left }}
          >
            <div className={menu.head}>
              <SvgIcon name="gear" color="blue" size="sm" />
              Cài đặt
            </div>
            <div className={menu.list}>
              {isAdmin && (
                <MenuItem
                  icon="shield"
                  color="purple"
                  title="Phân quyền & quản trị"
                  desc="Tạo tài khoản cán bộ, phân quyền đơn vị"
                  onClick={pick(onOpenAdmin)}
                />
              )}
              <MenuItem
                icon="lock"
                color="blue"
                title="Đổi mật khẩu"
                desc="Mật khẩu đăng nhập của tài khoản này"
                onClick={pick(onChangePassword)}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItem({ icon, color, title, desc, onClick }) {
  return (
    <button type="button" role="menuitem" className={menu.item} onClick={onClick}>
      <span className={menu.icon}>
        <SvgIcon name={icon} color={color} />
      </span>
      <span className={menu.text}>
        <span className={menu.title}>{title}</span>
        <span className={menu.desc}>{desc}</span>
      </span>
      <span className={menu.chevron} aria-hidden="true">
        ›
      </span>
    </button>
  );
}
