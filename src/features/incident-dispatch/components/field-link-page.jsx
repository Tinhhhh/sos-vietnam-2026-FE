import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { fieldArrive, getFieldPlan, sendFieldPosition } from '../api/field-api';
import { DispatchTrackingView } from './dispatch-tracking-view';
import styles from './field-link-page.module.css';

const REFRESH_MS = 10_000; // case status (arrived, closed...) besides the 5 s live position
const SEND_EVERY_MS = 5_000; // same pace as the Traccar app

/**
 * Field officer's link page /f/{token} (no login): the case, the route like a ride-hailing driver app, the citizen's
 * phone, "Mở Google Maps", "Đã đến", video calls (citizen / officer holding the case, wired by the route) and
 * "Bật gửi vị trí" from the browser (used only when the Traccar app is not sending: the app is more accurate).
 *
 * @param {{ token: string, onCall?: (to: 'citizen'|'officer', name: string|null) => void, callBusy?: boolean,
 *           onIncident?: (incidentId: string) => void }} props  onIncident: the route needs the id for calls
 */
export function FieldLinkPanel({ token, onCall, callBusy = false, onIncident }) {
  const toast = useToast();
  const [state, setState] = useState({ status: 'loading', data: null, error: null, code: null });
  const [arriving, setArriving] = useState(false);

  const load = useCallback(
    () =>
      getFieldPlan(token)
        .then((data) => setState({ status: 'ready', data, error: null, code: null }))
        .catch((err) =>
          setState((s) => ({
            ...s,
            status: s.data ? 'ready' : 'error',
            error: err.message,
            code: err.status,
          })),
        ),
    [token],
  );
  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const fetchPlan = useCallback(() => getFieldPlan(token).then((d) => d.plan), [token]);
  const data = state.data;
  const plan = data?.plan;
  const incidentId = data?.incidentId;
  useEffect(() => {
    if (incidentId) onIncident?.(incidentId);
  }, [incidentId, onIncident]);
  const enRoute = plan?.status === 'EN_ROUTE';
  const gps = useBrowserGps({ token, enabled: enRoute });

  if (state.code === 401 || state.code === 410 || (state.status === 'error' && !data)) {
    return (
      <div className={styles.page}>
        <div className={styles.gone}>
          <div className={styles.goneTitle}>
            {state.code === 410
              ? 'Ca đã kết thúc'
              : state.code === 401
                ? 'Link không còn hiệu lực'
                : 'Không tải được'}
          </div>
          <p>
            {state.code === 401
              ? 'Link đã được cấp lại hoặc đã đổi người phụ trách. Liên hệ cán bộ nhận ca để lấy link mới.'
              : state.code === 410
                ? 'Cảm ơn đồng chí. Ca này đã đóng.'
                : state.error}
          </p>
        </div>
      </div>
    );
  }
  if (!data || !plan) {
    return <div className={styles.page}>Đang tải...</div>;
  }

  const dest = plan.destination || plan.sosPoint;
  const mapsUrl = dest
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`
    : null;

  const arrive = async () => {
    setArriving(true);
    try {
      await fieldArrive(token);
      toast.show('Đã báo tới hiện trường', { tone: 'success' });
      load();
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setArriving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.kicker}>Người phụ trách hiện trường · Ca {data.incidentId}</div>
        <div className={styles.title}>{[data.typeLabel, data.tag].filter(Boolean).join(' · ')}</div>
        {data.address && <div className={styles.addr}>📍 {data.address}</div>}
        {data.description && <p className={styles.desc}>{data.description}</p>}
        <div className={styles.people}>
          <span>
            Người báo: <b>{data.citizenName || 'Không rõ'}</b>
            {data.citizenPhone && (
              <>
                {' '}
                · <a href={`tel:${data.citizenPhone}`}>{data.citizenPhone}</a>
              </>
            )}
          </span>
          {data.handlerName && (
            <span>
              Cán bộ nhận ca: <b>{data.handlerName}</b>
            </span>
          )}
        </div>
      </header>

      <DispatchTrackingView
        plan={plan}
        fetchPlan={fetchPlan}
        trackerCall={false}
        onCallReceiver={onCall ? (r) => onCall('officer', r.fullName || data.handlerName || null) : null}
        footer={
          <div className={styles.actions}>
            {mapsUrl && (
              <a className={styles.maps} href={mapsUrl} target="_blank" rel="noreferrer">
                Mở Google Maps chỉ đường
              </a>
            )}
            {onCall && (
              <>
                <button
                  type="button"
                  className={styles.call}
                  disabled={callBusy}
                  onClick={() => onCall('citizen', data.citizenName || null)}
                >
                  Gọi video người báo tin
                </button>
                <button
                  type="button"
                  className={styles.call}
                  disabled={callBusy}
                  onClick={() => onCall('officer', data.handlerName || null)}
                >
                  Gọi video cán bộ nhận ca
                </button>
              </>
            )}
            {enRoute && (
              <>
                <button
                  type="button"
                  className={gps.on ? styles.gpsOn : styles.gpsOff}
                  onClick={gps.on ? gps.stop : gps.start}
                >
                  {gps.on ? 'Tắt gửi vị trí' : 'Bật gửi vị trí'}
                </button>
                <div className={styles.gpsNote}>{gps.note}</div>
                <button type="button" className={styles.arrive} disabled={arriving} onClick={arrive}>
                  {arriving ? 'Đang gửi...' : 'Đã đến'}
                </button>
              </>
            )}
          </div>
        }
      />
    </div>
  );
}

/**
 * Browser GPS of the field officer: watchPosition while the page is open, one point every 5 s, screen kept on
 * (Wake Lock). Stops when the tab is hidden / the screen turns off: the Traccar app stays the main source.
 */
function useBrowserGps({ token, enabled }) {
  const [on, setOn] = useState(false);
  const [note, setNote] = useState('Dùng khi chưa bật app Traccar Client (app chính xác hơn, được ưu tiên).');
  const watchRef = useRef(null);
  const lastSentRef = useRef(0);
  const wakeRef = useRef(null);

  const stop = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
    wakeRef.current?.release?.().catch(() => {});
    wakeRef.current = null;
    setOn(false);
    setNote('Đã dừng gửi vị trí từ trình duyệt.');
  }, []);

  const start = useCallback(async () => {
    if (!navigator.geolocation) {
      setNote('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    try {
      wakeRef.current = await navigator.wakeLock?.request('screen');
    } catch {
      // no wake lock (iOS < 16.4...): the screen may turn off and stop GPS
    }
    setOn(true);
    setNote('Đang lấy vị trí...');
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < SEND_EVERY_MS) return;
        lastSentRef.current = now;
        const c = pos.coords;
        sendFieldPosition(token, {
          lat: c.latitude,
          lng: c.longitude,
          speedKmh: c.speed != null ? c.speed * 3.6 : null,
          heading: c.heading != null && !Number.isNaN(c.heading) ? c.heading : null,
          accuracyM: c.accuracy,
        })
          .then((taken) =>
            setNote(
              taken
                ? `Đang gửi vị trí (±${Math.round(c.accuracy)} m). Giữ màn hình sáng, đừng chuyển ứng dụng.`
                : 'App Traccar đang gửi vị trí (ưu tiên app).',
            ),
          )
          .catch(() => setNote('Mất mạng, sẽ gửi lại...'));
      },
      (err) => {
        setNote(
          err.code === 1
            ? 'Chưa cho phép truy cập vị trí: bật quyền vị trí cho trình duyệt.'
            : 'Không lấy được vị trí.',
        );
        if (err.code === 1) stop();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  }, [token, stop]);

  // trip no longer on the way (arrived / closed): stop
  useEffect(() => {
    if (!enabled && watchRef.current != null) stop();
  }, [enabled, stop]);
  useEffect(() => () => watchRef.current != null && navigator.geolocation?.clearWatch(watchRef.current), []);

  return { on, note, start, stop };
}
