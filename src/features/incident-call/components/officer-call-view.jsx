import { useState } from 'react';

import { CallIcon } from '@/components/ui/call-icons/call-icons';
import { VideoTile } from '@/components/ui/video-tile/video-tile';
import { useNow } from '@/hooks/use-now';
import { END_REASON_TEXT } from '@/lib/webrtc/call-session';

import styles from './incident-call.module.css';

const STATUS_TEXT = {
  ringing: ['Đang gọi người báo...', 'Chờ người dân bấm Nghe trên điện thoại.'],
  connecting: ['Đang kết nối cuộc gọi...', 'Đang tìm đường truyền tốt nhất (wifi / 4G).'],
  reconnecting: ['Mạng của người báo chập chờn', 'Đang tự kết nối lại, giữ máy...'],
};

const pad = (n) => String(n).padStart(2, '0');
const clock = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const duration = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

/**
 * Live video call pane (legacy "CUỘC GỌI TRỰC TIẾP"): the citizen's camera large, the officer's
 * webcam small at the bottom right, controls below. The shrunk command map sits on its right.
 *
 * @param {{ call: object, incident: object | null,
 *           onHangUp, onRecall, onClose, onToggleMic, onToggleCamera, onQuality }} props
 */
export function OfficerCallView({
  call,
  incident,
  onHangUp,
  onRecall,
  onClose,
  onToggleMic,
  onToggleCamera,
  onQuality,
}) {
  const now = useNow(true);
  const [volume, setVolume] = useState(1);
  const live = call.state === 'live';
  const ended = call.state === 'ended';
  const status = STATUS_TEXT[call.state];
  const citizen = call.peer?.name || incident?.citizenName || 'Người báo';

  return (
    <section className={styles.pane} aria-label="Cuộc gọi video với người báo">
      <header className={styles.header}>
        <span className={styles.headerTitle}>
          <CallIcon name="cam" style={{ color: '#f87171' }} /> CUỘC GỌI TRỰC TIẾP{' '}
          <small>· LIVE VIDEO CALL</small>
        </span>
        <span className={styles.headerMeta}>
          {call.incidentId} · {citizen}
          {incident?.phone ? ` · ${incident.phone}` : ''}
        </span>
      </header>

      <div className={styles.stage}>
        <VideoTile
          className={styles.remote}
          stream={call.remoteStream}
          fit="contain"
          volume={volume}
          fallback={
            live ? (
              <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                <div className={styles.avatar} style={{ margin: '0 auto 10px' }}>
                  🎙️
                </div>
                Người báo đang tắt camera hoặc chỉ gọi thoại
              </div>
            ) : null
          }
        />

        <div className={styles.overlayTop}>
          <span className={styles.clock}>
            <i className={styles.recDot} />
            {clock(now)}
            {live && call.connectedAt ? `, ${duration((now - call.connectedAt) / 1000)}` : ''}
          </span>
          {(live || call.state === 'reconnecting') && (
            <span className={`${styles.live} ${live ? '' : styles.liveWarn}`}>
              {live ? '((•)) LIVE' : 'ĐANG NỐI LẠI'}
            </span>
          )}
        </div>

        <VideoTile
          className={styles.pip}
          stream={call.localStream}
          muted
          mirrored
          fallback={<div className={styles.avatar}>👮</div>}
        >
          <span className={styles.pipLabel}>CÁN BỘ TIẾP NHẬN</span>
        </VideoTile>

        {status && (
          <div className={styles.status}>
            <div>{status[0]}</div>
            <div className={styles.statusSub}>{status[1]}</div>
            {call.state === 'ringing' && (
              <button type="button" className={`${styles.pill} ${styles.pillRed}`} onClick={onHangUp}>
                Huỷ cuộc gọi
              </button>
            )}
          </div>
        )}

        {ended && (
          <div className={styles.status}>
            <div>Cuộc gọi đã kết thúc</div>
            <div className={styles.statusSub}>{END_REASON_TEXT[call.endedReason] || ''}</div>
            <div className={styles.statusActions}>
              <button type="button" className={`${styles.pill} ${styles.pillGreen}`} onClick={onRecall}>
                <CallIcon name="phone" /> Gọi lại
              </button>
              <button type="button" className={styles.pill} onClick={onClose}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.bar}>
        <button
          type="button"
          className={`${styles.ctrl} ${call.micOn ? '' : styles.ctrlOff}`}
          title={call.micOn ? 'Tắt micro' : 'Bật micro'}
          disabled={ended || !call.localStream?.getAudioTracks().length}
          onClick={() => onToggleMic(!call.micOn)}
        >
          <CallIcon name={call.micOn ? 'mic' : 'micOff'} />
        </button>
        <button
          type="button"
          className={`${styles.ctrl} ${styles.hangup}`}
          title="Kết thúc cuộc gọi"
          disabled={ended}
          onClick={onHangUp}
        >
          <CallIcon name="hangup" />
        </button>
        <button
          type="button"
          className={`${styles.ctrl} ${call.cameraOn ? '' : styles.ctrlOff}`}
          title={call.hasCamera ? (call.cameraOn ? 'Tắt webcam' : 'Bật webcam') : 'Máy không có webcam'}
          disabled={ended || !call.hasCamera}
          onClick={() => onToggleCamera(!call.cameraOn)}
        >
          <CallIcon name={call.cameraOn && call.hasCamera ? 'cam' : 'camOff'} />
        </button>
        <button
          type="button"
          className={`${styles.ctrl} ${call.quality === 'detail' ? styles.ctrlOn : ''}`}
          title={
            call.quality === 'detail'
              ? 'Đang ưu tiên hình nét (giảm độ mượt). Bấm để quay lại hình mượt'
              : 'Xin hình nét: ưu tiên độ nét để đọc biển số, xem vết thương'
          }
          disabled={!live}
          onClick={() => onQuality(call.quality === 'detail' ? 'smooth' : 'detail')}
        >
          <CallIcon name="hd" />
        </button>
        <label className={styles.volume} title="Âm lượng người báo">
          <CallIcon name="volume" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
    </section>
  );
}

/**
 * Card on the shrunk map (like the "REAL-TIME GPS TRACKING" widget): coordinates, type,
 * time since the report.
 *
 * @param {{ incident: object | null, typeLabel?: string }} props
 */
export function CallMapCard({ incident, typeLabel }) {
  const now = useNow(!!incident);
  if (!incident) return null;
  return (
    <div className={styles.mapCard}>
      {incident.lat != null ? (
        <>
          <div>
            Lat: <b>{incident.lat.toFixed(5)}° N</b>
          </div>
          <div>
            Lon: <b>{incident.lng.toFixed(5)}° E</b>
          </div>
        </>
      ) : (
        <div>Chưa có toạ độ GPS</div>
      )}
      <div className={styles.mapCardType}>{typeLabel || incident.id}</div>
      {incident.createdAt && (
        <>
          <div className={styles.mapCardTimerLabel}>Đã trôi qua từ lúc báo</div>
          <div className={styles.mapCardTimer}>{duration((now - incident.createdAt.getTime()) / 1000)}</div>
        </>
      )}
    </div>
  );
}
