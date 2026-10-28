import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';
import { VoiceMuteIcon } from '@/components/ui/voice-mute-icon';
import { useNow } from '@/hooks/use-now';
import { CITIZEN_VOICE, useVoiceMuted } from '@/hooks/use-voice-muted';

import styles from './citizen-desktop.module.css';

const CLOCK = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'Asia/Ho_Chi_Minh',
});

const REFRESH_CLASS = { busy: styles.refreshBusy, ok: styles.refreshOk, warn: styles.refreshWarn };

/**
 * Top bar of the citizen home (Stitch reference). Desktop: one fixed row, system name + Vietnam time on the
 * left, compact GPS pill + "Tắt tiếng" + "Cổng" on the right. Phone: system pill + both buttons, then the GPS card.
 * "Tắt tiếng" silences the voice prompt of the SOS button (silent report).
 * Only real data: the GPS fix of the browser, no made-up weather or status numbers.
 *
 * @param {{ geo: object, onPickOnMap?: () => void, officerHref: string }} props
 */
export function CitizenTopBar({ geo, onPickOnMap, officerHref }) {
  const now = useNow(true);
  const locating = geo.status === 'locating' && !geo.coords;
  const unavailable = geo.status === 'unavailable' || (!geo.coords && !locating);
  const weak = geo.accuracy != null && geo.accuracy > 100;
  const [muted, setMuted] = useVoiceMuted(CITIZEN_VOICE);
  const toast = useToast();
  // refresh button: spins while locating, then a tick (or a warning) + a toast saying what was found
  const [refreshState, setRefreshState] = useState('idle'); // idle | busy | ok | warn
  const doneTimer = useRef(null);
  useEffect(() => () => clearTimeout(doneTimer.current), []);
  const refreshLocation = async () => {
    if (refreshState === 'busy') return;
    clearTimeout(doneTimer.current);
    setRefreshState('busy');
    const fix = await geo.refresh();
    if (!fix) {
      setRefreshState('idle'); // replaced by a newer run (map pick...)
      return;
    }
    if (fix.permissionDenied) {
      toast.show(
        'Bạn đang chặn quyền vị trí. Hãy cho phép vị trí trong cài đặt trình duyệt để lực lượng tìm thấy bạn.',
        {
          tone: 'error',
          duration: 7000,
        },
      );
    } else if (fix.status === 'gps') {
      toast.show(`Đã cập nhật vị trí GPS${fix.accuracy != null ? ` (sai số ±${fix.accuracy} m)` : ''}.`, {
        tone: 'success',
      });
    } else if (fix.status === 'ip') {
      toast.show(
        'Chưa lấy được GPS, đang dùng vị trí gần đúng theo mạng. Hãy bật định vị hoặc chọn trên bản đồ.',
        {
          tone: 'info',
          duration: 6000,
        },
      );
    } else {
      toast.show(
        'Không lấy được vị trí. Hãy bật định vị cho trình duyệt rồi thử lại, hoặc chọn trên bản đồ.',
        {
          tone: 'error',
          duration: 6000,
        },
      );
    }
    setRefreshState(fix.status === 'gps' ? 'ok' : 'warn');
    doneTimer.current = setTimeout(() => setRefreshState('idle'), 1800);
  };
  const muteLabel = muted ? 'Đang tắt tiếng hướng dẫn SOS, bấm để bật' : 'Tắt tiếng hướng dẫn khi bấm SOS';
  const officer = (
    <span className={styles.topActions}>
      <button
        type="button"
        className={`${styles.muteBtn} ${muted ? styles.muteOn : ''}`}
        aria-pressed={muted}
        aria-label={muteLabel}
        title={muteLabel}
        onClick={() => setMuted(!muted)}
      >
        <VoiceMuteIcon muted={muted} />
      </button>
      <a className={styles.officerLink} href={officerHref} target="_blank" rel="noopener" title="Cổng cán bộ">
        <svg className="svg-ico ico-sm" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        Cổng
      </a>
    </span>
  );

  return (
    <div className={styles.topBarWrap}>
      <div className={styles.topBar}>
        <div className={styles.row1}>
          <div className={`${styles.systemPill} ${styles.glass}`}>
            <span className={styles.liveDot} aria-hidden="true" />
            <span className={styles.systemName}>
              <span className={styles.longName}>Hệ thống điều phối khẩn cấp quốc gia 24/7</span>
              <span className={styles.shortName}>Điều phối 24/7</span>
            </span>
            <span className={styles.divider} aria-hidden="true" />
            <span className={styles.clock}>
              <svg className="svg-ico ico-xs ico-blue" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {CLOCK.format(now)}
              <span className={styles.longName}>&nbsp;· GMT+7</span>
            </span>
          </div>
          <span className={styles.phoneOnly}>{officer}</span>
        </div>

        <div className={`${styles.right} ${styles.gpsRow}`}>
          <div className={`${styles.gpsPill} ${styles.glass}`}>
            <span className={styles.gpsIcon} aria-hidden="true">
              <svg className="svg-ico ico-sm" viewBox="0 0 24 24">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <div className={styles.gpsTexts}>
              <div className={styles.gpsLabelRow}>
                <span className={styles.gpsLabel}>
                  {geo.status === 'manual'
                    ? 'Vị trí bạn chọn trên bản đồ'
                    : geo.permissionDenied
                      ? 'Chưa cho phép vị trí'
                      : 'Vị trí GPS của bạn'}
                </span>
                {geo.accuracy != null && geo.status !== 'manual' && (
                  <span className={`${styles.accuracy} ${weak ? styles.accuracyLow : ''}`}>
                    ±{geo.accuracy}m
                  </span>
                )}
              </div>
              <div className={styles.gpsLine}>
                {locating ? (
                  <span className={styles.gpsAddress}>Đang định vị GPS...</span>
                ) : geo.permissionDenied && geo.status !== 'manual' ? (
                  <span className={`${styles.gpsAddress} ${styles.gpsWarn}`}>
                    {geo.coords
                      ? 'Chỉ ước lượng theo mạng, có thể lệch xa'
                      : 'Bật vị trí để lực lượng tìm thấy bạn'}
                  </span>
                ) : unavailable ? (
                  <span className={`${styles.gpsAddress} ${styles.gpsWarn}`}>
                    Không lấy được vị trí của bạn
                  </span>
                ) : (
                  <>
                    <span className={styles.gpsAddress} title={geo.address || undefined}>
                      {geo.jurisdiction?.label ||
                        (geo.address && !/^tọa độ|^toạ độ/i.test(geo.address) ? geo.address : 'Đã có toạ độ')}
                    </span>
                    <span className={styles.gpsCoords}>
                      ({geo.coords.lat.toFixed(5)}, {geo.coords.lng.toFixed(5)})
                    </span>
                  </>
                )}
              </div>
            </div>
            {onPickOnMap && (
              <button
                type="button"
                className={styles.iconBtn}
                title="Tự chọn vị trí trên bản đồ"
                aria-label="Chọn vị trí trên bản đồ"
                onClick={onPickOnMap}
              >
                <svg className="svg-ico ico-xs" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
                  <path d="M9 4v14M15 6v14" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`${styles.iconBtn} ${REFRESH_CLASS[refreshState] || ''}`}
              title={refreshState === 'busy' ? 'Đang lấy lại vị trí...' : 'Làm mới vị trí GPS'}
              aria-label="Làm mới vị trí GPS"
              aria-busy={refreshState === 'busy'}
              onClick={refreshLocation}
            >
              {refreshState === 'ok' ? (
                <svg className="svg-ico ico-xs" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : refreshState === 'warn' ? (
                <svg className="svg-ico ico-xs" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8v5M12 16.5v.5" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              ) : (
                <svg className="svg-ico ico-xs" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              )}
            </button>
          </div>

          <span className={styles.desktopOnlyInline}>{officer}</span>
        </div>
      </div>
    </div>
  );
}
