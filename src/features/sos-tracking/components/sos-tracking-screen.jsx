import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CallIcon } from '@/components/ui/call-icons/call-icons';
import { useCall } from '@/hooks/use-call';
import { useNow } from '@/hooks/use-now';
import { END_REASON_TEXT, VIDEO_PROFILES } from '@/lib/webrtc/call-session';
import { getIceServers } from '@/lib/webrtc/ice-servers';

import { cancelIncident, requestProvince } from '../api/tracking';
import { useIncidentTracking } from '../hooks/use-incident-tracking';
import { CLOSED_STATUSES, TYPE_TEXT, receivingUnit } from '../utils/tracking-model';
import { CancelControl } from './cancel-control';
import { CitizenCallScreen } from './citizen-call-screen';
import styles from './sos-tracking.module.css';
import { WaitTimer } from './wait-timer';

const CONNECTION = {
  live: { color: '#34d399', text: 'Đã kết nối' },
  connecting: { color: '#fbbf24', text: 'Đang kết nối' },
  reconnecting: { color: '#f87171', text: 'Đang kết nối lại' },
};

const IN_CALL = ['ringing', 'connecting', 'live', 'reconnecting'];

/**
 * Screen the citizen sees right after sending an SOS, shaped like an outgoing phone call:
 * red phone in the middle while waiting, the officer's video call rings here, "Huỷ báo cáo"
 * (5 s lock) and the wait timer at the bottom.
 *
 * @param {{ initialIncident: object, token: string, notify: Function,
 *           onClosed: (message?: string) => void }} props
 *   initialIncident: raw incident from POST /incidents (or the copy saved in sessionStorage)
 */
export function SosTrackingScreen(props) {
  // Portal to <body>: the portal's main column creates a stacking context under the dock
  return createPortal(<TrackingContent {...props} />, document.body);
}

function TrackingContent({ initialIncident, token, notify, onClosed }) {
  // The tracking socket also carries call signals; the call hook is created after it
  const signalHandler = useRef(() => {});
  const tracking = useIncidentTracking({
    initial: initialIncident,
    token,
    onCallSignal: (signal) => signalHandler.current(signal),
  });
  const { incident, connection } = tracking;

  const phone = useCall({
    send: tracking.sendSignal,
    getIceServers: () => getIceServers({ incidentId: incident.id, citizenAccessToken: token }),
    videoProfile: VIDEO_PROFILES.scene,
    facingMode: 'environment', // film the scene first
  });
  useEffect(() => {
    signalHandler.current = phone.handleSignal;
  });

  const now = useNow(true);
  const [cancelling, setCancelling] = useState(false);
  const { call } = phone;
  const closed = CLOSED_STATUSES.includes(incident.status);
  const unit = incident.handler?.unitName || receivingUnit(incident);
  const type = TYPE_TEXT[incident.type] || TYPE_TEXT.POLICE;

  // The officer closed / cancelled the incident: no more calls
  const hangUp = phone.hangUp;
  useEffect(() => {
    if (closed) hangUp();
  }, [closed, hangUp]);

  const [requesting, setRequesting] = useState(false);
  const askProvince = async () => {
    if (!window.confirm('Chuyển tin báo lên cấp tỉnh/thành phố? Cán bộ xã/phường sẽ không giữ ca này nữa.'))
      return;
    setRequesting(true);
    try {
      const updated = await requestProvince(incident.id, token);
      if (updated) tracking.setIncident(updated);
      notify('Đã chuyển tin báo lên cấp tỉnh/thành phố. Vui lòng giữ máy.', { tone: 'success' });
    } catch (err) {
      notify(`Không chuyển được: ${err.message}`, { tone: 'error' });
    } finally {
      setRequesting(false);
    }
  };

  const confirmCancel = async (reason) => {
    setCancelling(true);
    try {
      await cancelIncident(incident.id, token, reason);
      phone.hangUp();
      onClosed('Đã huỷ báo cáo SOS. Nếu cần hỗ trợ, hãy gửi lại hoặc gọi 113 / 114 / 115.');
    } catch (err) {
      const missing = err.status === 404 || err.status === 405;
      notify(missing ? 'Máy chủ chưa hỗ trợ huỷ báo cáo.' : `Không huỷ được: ${err.message}`, {
        tone: 'error',
      });
      setCancelling(false);
    }
  };

  const callBack = () =>
    phone.startCall({ incidentId: incident.id, peer: { name: incident.handler?.fullName || null } });

  if (call && IN_CALL.includes(call.state)) {
    return (
      <CitizenCallScreen
        call={call}
        officerName={call.peer?.name || incident.handler?.fullName}
        onHangUp={phone.hangUp}
        onToggleMic={phone.setMic}
        onToggleCamera={phone.setCamera}
        onSwitchCamera={phone.switchCamera}
      />
    );
  }

  const conn = CONNECTION[connection] || CONNECTION.connecting;
  const incoming = call?.state === 'incoming';
  const accepted = !!incident.handler || incident.status !== 'PENDING';

  return (
    <div className={styles.screen} role="dialog" aria-label="Đang chờ tiếp nhận SOS">
      <div className={styles.top}>
        <span className={styles.typeChip}>
          {type.icon} {type.label}
        </span>
        <span className={styles.conn}>
          <i
            className={styles.connDot}
            style={{ background: conn.color, boxShadow: `0 0 8px ${conn.color}` }}
          />
          {conn.text}
        </span>
      </div>

      <div className={styles.center}>
        <div className={styles.phoneWrap}>
          {!closed && (
            <>
              <i className={`${styles.pulse} ${accepted ? styles.pulseAccepted : ''}`} />
              <i className={`${styles.pulse} ${accepted ? styles.pulseAccepted : ''}`} />
              <i className={`${styles.pulse} ${accepted ? styles.pulseAccepted : ''}`} />
            </>
          )}
          <span className={`${styles.phone} ${accepted && !incoming ? styles.phoneAccepted : ''}`}>
            <CallIcon name="phone" />
          </span>
        </div>

        <div>
          <StatusText
            incident={incident}
            unit={unit}
            incoming={incoming}
            call={call}
            peerName={call?.peer?.name}
          />
          {incident.lookupCode ? (
            <LookupCode code={incident.lookupCode} />
          ) : (
            <div className={styles.incidentId}>Mã tin báo: {incident.id}</div>
          )}
        </div>

        {incoming && (
          <div className={styles.incomingActions}>
            <button
              type="button"
              className={`${styles.roundAction} ${styles.rejectBtn}`}
              onClick={phone.reject}
            >
              <span>
                <CallIcon name="hangup" />
              </span>
              Từ chối
            </button>
            <button
              type="button"
              className={`${styles.roundAction} ${styles.acceptBtn}`}
              onClick={phone.accept}
            >
              <span>
                <CallIcon name="phone" />
              </span>
              Nghe
            </button>
          </div>
        )}

        {!incoming && !closed && incident.handler && (
          <button
            type="button"
            className={styles.callBackBtn}
            onClick={callBack}
            disabled={connection !== 'live'}
          >
            <CallIcon name="phone" /> Gọi video cho cán bộ
          </button>
        )}

        {closed && (
          <button type="button" className={styles.callBackBtn} onClick={() => onClosed()}>
            Về trang chủ
          </button>
        )}
      </div>

      {!closed && (
        <div className={styles.bottom}>
          <CancelControl busy={cancelling} onConfirm={confirmCancel} />
          <WaitTimer incident={incident} now={now} busy={requesting} onRequestProvince={askProvince} />
        </div>
      )}
    </div>
  );
}

/** Shown once the incident is RESOLVED: code + last 4 phone digits re-open the record via "Tra Cứu". */
function LookupCode({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={styles.lookupBox}>
      <div className={styles.lookupLabel}>Mã tra cứu của bạn</div>
      <div className={styles.lookupRow}>
        <span className={styles.lookupCode}>{code}</span>
        <button type="button" className={styles.lookupCopy} onClick={copy}>
          {copied ? 'Đã chép' : 'Sao chép'}
        </button>
      </div>
      <div className={styles.lookupHint}>
        Lưu lại mã này. Bấm "Tra Cứu" ở trang chủ, nhập mã và 4 số cuối số điện thoại để xem lại thông tin cứu
        hộ.
      </div>
    </div>
  );
}

/** "Cán bộ Nguyễn Văn A"; account names that already start with "Cán bộ" are not doubled. */
function officerTitle(name) {
  return /^cán bộ/i.test(name) ? name : `Cán bộ ${name}`;
}

function StatusText({ incident, unit, incoming, call, peerName }) {
  let title;
  let sub;
  if (incoming) {
    title = `${peerName || 'Cán bộ'} đang gọi video cho bạn`;
    sub = `${unit}. Bấm Nghe để nói chuyện và cho cán bộ xem hiện trường.`;
  } else if (incident.status === 'CANCELLED') {
    // NO_RESPONDER: the server cancelled it after waiting too long with nobody taking it
    const auto = incident.cancelReason === 'NO_RESPONDER';
    title = auto ? 'Tin báo đã tự huỷ vì quá lâu không có cán bộ tiếp nhận' : 'Tin báo đã được huỷ';
    sub = `${!auto && incident.cancelReasonLabel ? `Lý do: ${incident.cancelReasonLabel}. ` : ''}Nếu vẫn cần hỗ trợ, hãy gửi SOS mới hoặc gọi ngay 113 / 114 / 115.`;
  } else if (incident.status === 'RESOLVED') {
    title = 'Sự việc đã được xử lý xong';
    sub = 'Cảm ơn bạn đã báo tin.';
  } else if (incident.status === 'RESOLVING') {
    title = 'Lực lượng đang được điều động tới hiện trường';
    sub = `${unit}${incident.handler ? ` · ${officerTitle(incident.handler.fullName)}` : ''}. Giữ an toàn và giữ máy.`;
  } else if (incident.handler) {
    title = `${officerTitle(incident.handler.fullName)} đang xác minh tin báo`;
    sub = `${unit}. Cán bộ sẽ gọi video để xác minh, hoặc bạn có thể gọi trước.`;
  } else {
    title = `Đang kết nối tới ${unit}...`;
    sub = incident.escalatedAt
      ? 'Tin báo đã được chuyển lên cấp tỉnh/thành phố. Vui lòng giữ máy.'
      : 'Giữ màn hình này mở. Cán bộ sẽ gọi video cho bạn ngay khi tiếp nhận.';
  }
  const ended = call?.state === 'ended' && !incoming ? END_REASON_TEXT[call.endedReason] : null;
  return (
    <>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.sub}>{sub}</p>
      {ended && (
        <p className={styles.sub} style={{ color: '#fca5a5' }}>
          Cuộc gọi đã kết thúc: {ended.toLowerCase()}
        </p>
      )}
    </>
  );
}
