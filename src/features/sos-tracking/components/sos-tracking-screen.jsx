import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CallIcon } from '@/components/ui/call-icons/call-icons';
import { CallSwitchDialog } from '@/components/ui/call-switch-dialog/call-switch-dialog';
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
// Same as BE app.incident.auto-cancel-minutes: nobody took it in this time -> the report has expired
const EXPIRE_MS = 60 * 60 * 1000;
const AUTO_RETURN_S = 5;

/**
 * Screen the citizen sees right after sending an SOS, shaped like an outgoing phone call:
 * red phone in the middle while waiting, the officer's video call rings here, "Huỷ báo cáo"
 * (5 s lock) and the wait timer at the bottom.
 *
 * @param {{ initialIncident: object, token: string, notify: Function,
 *           onClosed: (message?: string) => void,
 *           dispatchSlot?: (p: { incident: object, token: string, variant: 'call'|'screen' }) => React.ReactNode,
 *           documentSlot?: (p: { incident: object, token: string }) => React.ReactNode,
 *           mediaSlot?: (p: { incident: object, token: string }) => React.ReactNode }} props
 *   mediaSlot: "Bổ sung ảnh / video" of the SOS form feature, shown once an officer took the report
 *   initialIncident: raw incident from POST /incidents (or the copy saved in sessionStorage)
 *   dispatchSlot: "..." button of the dispatch feature (tracking map), composed by the route
 *   documentSlot: "Xem & ký văn bản báo cáo" of the report feature, shown once the incident is RESOLVED
 */
export function SosTrackingScreen(props) {
  // Portal to <body>: the portal's main column creates a stacking context under the dock
  return createPortal(<TrackingContent {...props} />, document.body);
}

function TrackingContent({
  initialIncident,
  token,
  notify,
  onClosed,
  dispatchSlot,
  documentSlot,
  mediaSlot,
}) {
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
  // Waited over an hour with nobody taking it (BE auto-cancels it too; this also covers a lost connection)
  const expired =
    incident.status === 'PENDING' && !incident.handler && now - incident.createdAt.getTime() > EXPIRE_MS;
  const closed = CLOSED_STATUSES.includes(incident.status) || expired;
  // RESOLVED: go home by itself only once the citizen signed the report, or an hour after the case closed
  // (officers may never write one). Cancelled / expired: right away.
  const signed = ['CITIZEN_SIGNED', 'SIGNED'].includes(incident.documentStatus);
  const resolvedLongAgo = !!incident.resolvedAt && now - incident.resolvedAt.getTime() > EXPIRE_MS;
  const autoReturn = closed && (incident.status !== 'RESOLVED' || signed || resolvedLongAgo);
  // A click on the closed screen (copy the code, read / sign the report) stops the countdown, until the
  // report status changes (e.g. the citizen just signed: count again)
  const [stayedFor, setStayedFor] = useState(null);
  const stayed = stayedFor === incident.documentStatus;
  const unit = incident.handler?.unitName || receivingUnit(incident);
  const type = TYPE_TEXT[incident.type] || TYPE_TEXT.POLICE;

  // The officer closed / cancelled the incident: no more calls
  const hangUp = phone.hangUp;
  useEffect(() => {
    if (closed) hangUp();
  }, [closed, hangUp]);

  const [requesting, setRequesting] = useState(false);
  const askProvince = async () => {
    if (!window.confirm('Chuyển tin báo lên cấp tỉnh/thành phố? Cấp xã/phường sẽ không xử lý ca này nữa.'))
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
    phone.startCall({
      incidentId: incident.id,
      to: 'officer',
      peer: { name: incident.handler?.fullName || null, role: 'officer' },
    });
  // "Gọi" on the tracking card: video call to the field officer (người phụ trách hiện trường)
  const callTracker = (tracker) =>
    phone.startCall({
      incidentId: incident.id,
      to: 'field',
      peer: { name: tracker?.fullName || null, role: 'field' },
    });
  const switchDialog = (
    <CallSwitchDialog waiting={phone.waiting} onYes={phone.switchToWaiting} onNo={phone.declineWaiting} />
  );
  const peerLabel = (c) =>
    c?.peer?.role === 'field' ? `Người phụ trách hiện trường ${c.peer.name || ''}`.trim() : c?.peer?.name;

  if (call && IN_CALL.includes(call.state)) {
    return (
      <>
        <CitizenCallScreen
          call={call}
          officerName={peerLabel(call) || incident.handler?.fullName}
          onHangUp={phone.hangUp}
          onToggleMic={phone.setMic}
          onToggleCamera={phone.setCamera}
          onSwitchCamera={phone.switchCamera}
          extraControl={!closed && dispatchSlot?.({ incident, token, variant: 'call', callTracker })}
        />
        {switchDialog}
      </>
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
        {!closed && dispatchSlot?.({ incident, token, variant: 'screen', callTracker })}
      </div>

      <div className={styles.center} onClickCapture={() => closed && setStayedFor(incident.documentStatus)}>
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
            expired={expired}
            incident={incident}
            unit={unit}
            incoming={incoming}
            call={call}
            peerName={peerLabel(call)}
          />
          {incident.lookupCode ? (
            <>
              <LookupCode code={incident.lookupCode} />
              {incident.status === 'RESOLVED' && documentSlot?.({ incident, token })}
            </>
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
            <CallIcon name="phone" /> Gọi video cho lực lượng chức năng
          </button>
        )}

        {!incoming &&
          ['VERIFYING', 'RESOLVING'].includes(incident.status) &&
          mediaSlot?.({ incident, token })}

        {closed && incident.status === 'RESOLVED' && !signed && !resolvedLongAgo && (
          <p className={styles.sub} style={{ color: '#fcd34d' }}>
            {incident.documentStatus === 'NONE'
              ? 'Lực lượng chức năng đang lập biên bản sự việc. Vui lòng chờ để ký xác nhận.'
              : 'Vui lòng ký xác nhận biên bản: bấm "Xem & ký văn bản báo cáo".'}
          </p>
        )}
        {closed && (
          <AutoReturn
            key={`${incident.documentStatus}-${autoReturn}`}
            paused={stayed || !autoReturn}
            onReturn={() => onClosed()}
          />
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

/** "Về trang chủ (5s)": the closed screen goes back to the menu by itself unless the citizen is using it. */
function AutoReturn({ paused, onReturn }) {
  const [start] = useState(() => Date.now());
  const now = useNow(!paused, 250);
  const left = Math.max(0, AUTO_RETURN_S - Math.floor((now - start) / 1000));
  useEffect(() => {
    if (!paused && left === 0) onReturn();
  }, [paused, left, onReturn]);
  return (
    <button type="button" className={styles.callBackBtn} onClick={onReturn}>
      Về trang chủ{paused ? '' : ` (${left}s)`}
    </button>
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

/** The handler as citizens see it: the account name (often the unit, e.g. "Công an TP. Hồ Chí Minh"), else a generic label. */
function officerTitle(name) {
  return name || 'Lực lượng chức năng';
}

function StatusText({ incident, unit, incoming, call, peerName, expired }) {
  let title;
  let sub;
  if (expired) {
    title = 'Đã quá thời gian chờ tiếp nhận';
    sub =
      'Chưa có lực lượng chức năng tiếp nhận tin báo sau 1 giờ. Nếu vẫn cần hỗ trợ, hãy gửi SOS mới hoặc gọi ngay 113 / 114 / 115.';
  } else if (incoming) {
    title = `${peerName || 'Lực lượng chức năng'} đang gọi video cho bạn`;
    sub = `${unit}. Bấm Nghe để nói chuyện và cho lực lượng chức năng xem hiện trường.`;
  } else if (incident.status === 'CANCELLED') {
    // NO_RESPONDER: the server cancelled it after waiting too long with nobody taking it
    const auto = incident.cancelReason === 'NO_RESPONDER';
    title = auto
      ? 'Tin báo đã tự huỷ vì quá lâu không có lực lượng chức năng tiếp nhận'
      : 'Tin báo đã được huỷ';
    sub = `${!auto && incident.cancelReasonLabel ? `Lý do: ${incident.cancelReasonLabel}. ` : ''}Nếu vẫn cần hỗ trợ, hãy gửi SOS mới hoặc gọi ngay 113 / 114 / 115.`;
  } else if (incident.status === 'RESOLVED') {
    title = 'Sự việc đã được xử lý xong';
    sub = 'Cảm ơn bạn đã báo tin.';
  } else if (incident.status === 'RESOLVING') {
    title = 'Lực lượng đang được điều động tới hiện trường';
    sub = `${unit}${incident.handler ? ` · ${officerTitle(incident.handler.fullName)}` : ''}. Giữ an toàn và giữ máy.`;
  } else if (incident.handler) {
    title = `${officerTitle(incident.handler.fullName)} đang xác minh tin báo`;
    sub = `${unit}. Lực lượng chức năng sẽ gọi video để xác minh, hoặc bạn có thể gọi trước.`;
  } else {
    title = (
      <>
        Đang kết nối tới
        <br />
        {unit}...
      </>
    );
    sub = incident.escalatedAt
      ? 'Tin báo đã được chuyển lên cấp tỉnh/thành phố. Vui lòng giữ máy.'
      : 'Giữ màn hình, cơ quan chức năng sẽ gọi cho bạn ngay khi tiếp nhận.';
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
