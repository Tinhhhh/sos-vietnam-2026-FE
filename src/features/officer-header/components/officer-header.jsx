import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import { useVnClock } from '../hooks/use-vn-clock';
import { useWeather } from '../hooks/use-weather';
import styles from './officer-header.module.css';

/**
 * Officer console header (legacy dispatcher.html <header class="header-nav">):
 * brand pill, VN clock, weather, unit location, duty officer pill, gear menu.
 *
 * @param {{
 *   officer: ReturnType<import('@/features/auth').buildOfficerProfile>,
 *   unitCoords?: { lat: number, lng: number } | null,
 *   onLocateUnit?: () => void,
 *   onOpenAdmin?: () => void,
 *   onOpenOfficerInfo?: () => void,
 *   onLogout: () => void,
 * }} props
 */
export function OfficerHeader({
  officer,
  unitCoords,
  onLocateUnit,
  onOpenAdmin,
  onOpenOfficerInfo,
  onLogout,
}) {
  const clock = useVnClock();
  const weather = useWeather(unitCoords);

  return (
    <header className={styles.headerNav}>
      <div className={`${styles.headerNavLeftPill} liquid-glass`}>
        <div className={styles.headerNationalCrest}>
          <img src="/assets/icons/khien.png" className={styles.headerCrestImg} alt="Huy hiệu tác chiến" />
        </div>
        <div className={styles.headerTitleWrap}>
          <div className={styles.headerMainTitle}>{officer.brandTitle}</div>
          <div className={styles.headerSubTitle}>TỔNG HỢP - GIÁM SÁT - ĐIỀU PHỐI</div>
        </div>
      </div>

      <div className={styles.headerNavRightWidgets}>
        <div className={`${styles.headerWidgetPill} ${styles.vnLiveClock} liquid-glass`}>
          <SvgIcon name="clock" color="blue" className={styles.widgetIcon} />
          <div className={styles.widgetText}>
            <span className={`${styles.widgetPrimary} ${styles.clockTimeVal}`}>
              <span className={styles.clockTimeDigits}>{clock.time}</span>{' '}
              <span className={styles.clockTimeZone}>(VN)</span>
            </span>
            <span className={`${styles.widgetSecondary} ${styles.clockDateVal}`}>{clock.date}</span>
          </div>
        </div>

        <WeatherPill weather={weather} />

        <div
          className={`${styles.headerWidgetPill} ${styles.clickableLocationPill} ${styles.locationWidget} liquid-glass`}
          title="Đơn vị trực ban (Bấm để xem trên bản đồ)"
          onClick={onLocateUnit}
        >
          <span className={styles.widgetIcon}>
            <SvgIcon name="pin" color="amber" />
          </span>
          <div className={styles.widgetText}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span className={styles.widgetPrimary}>{officer.unitName}</span>
              <span className={styles.gpsLiveDot} style={{ flexShrink: 0 }} />
            </div>
            <span className={styles.widgetSecondary}>{officer.unitSub}</span>
          </div>
        </div>

        <div
          className={`${styles.headerWidgetPill} ${styles.clickableOfficerPill} ${styles.headerDutyShiftPill} liquid-glass`}
          title="Kíp trực ban tác chiến (Bấm để xem & giao ca)"
          style={{ cursor: 'pointer', borderColor: 'rgba(56, 189, 248, 0.45)', display: 'flex' }}
          onClick={onOpenOfficerInfo}
        >
          <span className={styles.widgetIcon} style={{ color: '#38bdf8' }}>
            <SvgIcon name="user" color="blue" />
          </span>
          <div className={styles.widgetText}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span className={styles.widgetPrimary} style={{ color: '#38bdf8', fontWeight: 700 }}>
                {officer.fullName}
              </span>
              <span
                className={styles.headerDutyBadge}
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  background: '#10b981',
                  color: '#fff',
                  padding: '1px 5px',
                  borderRadius: 4,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                TRỰC BAN
              </span>
            </div>
            <span className={styles.widgetSecondary}>Ca trực: chưa phân ca</span>
          </div>
        </div>

        <GearMenu
          isAdmin={officer.isAdmin}
          onOpenAdmin={onOpenAdmin}
          onOpenOfficerInfo={onOpenOfficerInfo}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}

function WeatherPill({ weather }) {
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
    <div
      className={`${styles.headerWidgetPill} ${styles.clickableWeatherPill} ${styles.weatherWidget} liquid-glass`}
      title="Thời tiết tại đơn vị (Bấm để làm mới)"
      style={{ cursor: 'pointer' }}
      onClick={weather.refresh}
    >
      <span className={styles.widgetIcon}>
        <SvgIcon name={isNight ? 'moon' : 'sun'} color={isNight ? 'purple' : 'amber'} />
      </span>
      <div className={styles.widgetText}>
        <span className={styles.widgetPrimary}>{primary}</span>
        <span className={styles.widgetSecondary}>{secondary}</span>
      </div>
    </div>
  );
}

function GearMenu({ isAdmin, onOpenAdmin, onOpenOfficerInfo, onLogout }) {
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
    setPos({ top: rect.bottom + 10, right: window.innerWidth - rect.right });
  };

  const pick = (fn) => () => {
    setPos(null);
    fn?.();
  };

  return (
    <div className={styles.headerIconButtons}>
      <div style={{ position: 'relative' }} className={styles.gearSettingsWrap}>
        <button
          ref={btnRef}
          type="button"
          className={`${styles.headerCircleBtn} liquid-glass`}
          title="Cài đặt hệ thống & Quản trị an ninh"
          onClick={toggle}
        >
          <SvgIcon name="gear" size="sm" color="white" />
        </button>
      </div>

      {pos &&
        createPortal(
          <div
            ref={menuRef}
            className={`${styles.gearDropdownMenu} liquid-glass`}
            style={{
              display: 'flex',
              position: 'fixed',
              zIndex: 99999,
              top: pos.top,
              right: pos.right,
              left: 'auto',
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

            <div
              className={styles.gearMenuItem}
              title="Hồ sơ cán bộ trực ban & phân công kíp trực"
              onClick={pick(onOpenOfficerInfo)}
            >
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
                <div className={styles.gearMenuDesc}>Hồ sơ ca trực, phân công, trực thay</div>
              </div>
            </div>

            <div className={styles.gearMenuDivider} />

            <div
              className={styles.gearMenuItem}
              title="Đăng xuất khỏi phiên trực ban"
              onClick={pick(onLogout)}
            >
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
    </div>
  );
}
