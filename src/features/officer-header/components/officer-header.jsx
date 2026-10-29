import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';
import { VoiceMuteIcon } from '@/components/ui/voice-mute-icon';
import { OFFICER_VOICE, useVoiceMuted } from '@/hooks/use-voice-muted';

import { useVnClock } from '../hooks/use-vn-clock';
import { useWeather } from '../hooks/use-weather';
import ui from './console-header.module.css';

/**
 * Officer console header (flat bar, national dispatch design): crest + system title on the left;
 * VN clock, weather, unit location, incident bell (pending count, opens the queue window) and
 * the signed-in officer on the right. Settings (OfficerSettingsDialog) / logout live in the console's left rail.
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
  // mutes only the voice reading out a new SOS; the siren + chime still play
  const [muted, setMuted] = useVoiceMuted(OFFICER_VOICE);
  const muteLabel = muted ? 'Đang tắt giọng đọc ca SOS mới, bấm để bật' : 'Tắt giọng đọc ca SOS mới';

  return (
    <header className={ui.bar}>
      <div className={ui.brand}>
        <img src="/assets/icons/khien.png" className={ui.crest} alt="Huy hiệu Công an nhân dân" />
        <div className={ui.titles}>
          {/* one line on wide screens; on phones two lines split where the phrase breaks naturally */}
          <div className={ui.title}>
            <span className={ui.titlePart}>Hệ Thống Điều Phối</span>{' '}
            <span className={ui.titlePart}>Khẩn Cấp Quốc Gia 24/7</span>
          </div>
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
          className={`${ui.iconBtn} ${muted ? ui.muteOn : ''}`}
          title={muteLabel}
          aria-label={muteLabel}
          aria-pressed={muted}
          onClick={() => {
            setMuted(!muted);
          }}
        >
          <VoiceMuteIcon muted={muted} />
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
              {officer.isAdmin ? 'Quản trị hệ thống' : `${officer.roleLabel || 'Cán bộ'} · Đang trực tuyến`}
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
