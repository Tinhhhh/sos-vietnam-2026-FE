import { CallIcon } from '@/components/ui/call-icons/call-icons';
import { VideoTile } from '@/components/ui/video-tile/video-tile';
import { useNow } from '@/hooks/use-now';

import { formatDuration } from '../utils/tracking-model';
import styles from './sos-tracking.module.css';

const STATE_TEXT = {
  ringing: 'Đang gọi lực lượng chức năng...',
  connecting: 'Đang kết nối cuộc gọi...',
  reconnecting: 'Mạng yếu, đang kết nối lại...',
};

/**
 * Citizen during a call: own camera full screen (they aim it at the scene), the officer in a
 * small tile, controls at the bottom. Back camera first; mirrored only for the front camera.
 *
 * @param {{ call: object, officerName?: string | null,
 *           onHangUp, onToggleMic, onToggleCamera, onSwitchCamera }} props
 */
export function CitizenCallScreen({
  call,
  officerName,
  onHangUp,
  onToggleMic,
  onToggleCamera,
  onSwitchCamera,
  extraControl = null, // e.g. the "..." dispatch tracking button
}) {
  const now = useNow(call.state === 'live');
  const overlay = STATE_TEXT[call.state];

  return (
    <div className={styles.callScreen}>
      <VideoTile
        className={styles.callMain}
        stream={call.localStream}
        muted
        mirrored={call.facingMode === 'user'}
        fallback={
          <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
            <div className={styles.avatar} style={{ margin: '0 auto 10px' }}>
              🎙️
            </div>
            {call.hasCamera ? 'Camera đang tắt' : 'Chỉ gọi thoại (không mở được camera)'}
          </div>
        }
      />

      {/* Officer: video if their webcam is on; their voice plays from this element in any case */}
      <VideoTile
        className={styles.pip}
        stream={call.remoteStream}
        fallback={<div className={styles.avatar}>👮</div>}
      >
        <span className={styles.pipLabel}>CÁN BỘ</span>
      </VideoTile>

      <div className={styles.callTop}>
        <span className={styles.callBadge}>
          <i className={styles.liveDot} />
          {call.state === 'live' && call.connectedAt
            ? formatDuration((now - call.connectedAt) / 1000)
            : 'SOS'}
        </span>
        <span className={styles.callBadge} style={{ marginRight: 'min(32vw, 160px)' }}>
          {officerName || 'Lực lượng chức năng'}
        </span>
      </div>

      {overlay && <div className={styles.callStatusOverlay}>{overlay}</div>}

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.ctrl} ${call.micOn ? '' : styles.ctrlOff}`}
          aria-label={call.micOn ? 'Tắt micro' : 'Bật micro'}
          disabled={!call.localStream?.getAudioTracks().length}
          onClick={() => onToggleMic(!call.micOn)}
        >
          <CallIcon name={call.micOn ? 'mic' : 'micOff'} />
        </button>
        <button
          type="button"
          className={`${styles.ctrl} ${call.cameraOn ? '' : styles.ctrlOff}`}
          aria-label={call.cameraOn ? 'Tắt camera' : 'Bật camera'}
          disabled={!call.hasCamera}
          onClick={() => onToggleCamera(!call.cameraOn)}
        >
          <CallIcon name={call.cameraOn ? 'cam' : 'camOff'} />
        </button>
        <button
          type="button"
          className={styles.ctrl}
          aria-label="Đổi camera trước / sau"
          disabled={!call.hasCamera}
          onClick={onSwitchCamera}
        >
          <CallIcon name="switchCam" />
        </button>
        {extraControl}
        <button
          type="button"
          className={`${styles.ctrl} ${styles.ctrlHangup}`}
          aria-label="Kết thúc cuộc gọi"
          onClick={onHangUp}
        >
          <CallIcon name="hangup" />
        </button>
      </div>
    </div>
  );
}
