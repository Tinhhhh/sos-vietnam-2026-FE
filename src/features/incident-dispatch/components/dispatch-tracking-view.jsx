import { useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';
import { useNow } from '@/hooks/use-now';

import { detourSimulation, startSimulation, stopSimulation } from '../api/dispatch-api';
import { formatDistance, formatDuration } from '../api/routing';
import { useLivePosition } from '../hooks/use-live-position';
import { STATION_ICON } from '../utils/origin-candidates';
import styles from './dispatch-tracking.module.css';
import { RouteMap } from './route-map';

const CLOCK = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const DELAY_NOTE = 'Thời gian thực tế có thể lâu hơn do ùn tắc giao thông hoặc thời tiết không thuận lợi.';
const MAP_PADDING = { top: 56, bottom: 28, left: 36, right: 36 }; // room for the status chip
/** No new GPS point for this long: "Đang kết nối lại…" (the app sends one every 5 s). */
const STALE_MS = 20000;

const telOf = (phone) => (phone || '').replace(/[^0-9+]/g, '');

/**
 * "Theo dõi" like a ride-hailing app: map with the station emblem, the SOS point, the route and, while
 * the force is on the way, the live GPS dot of the field officer (Traccar Client on their phone, polled
 * every 5 s); then a card with "Người nhận ca" (the officer holding the case), the delegated ward officer if any,
 * "Người đi hiện trường" (the field officer: name, badge, call), the unit, ETA and distance. Used by the citizen's
 * tracking sheet, the ward card, the field link page and step 3 of the dispatch window.
 *
 * @param {{ plan: object, incidentId?: string, citizenToken?: string, variant?: 'inline' | 'sheet',
 *           footer?: React.ReactNode, actions?: React.ReactNode }} props  plan from normalizePlan(); incidentId
 *   enables the live GPS; sheet = fills its (full-screen) parent: map takes the free height, the card sits at
 *   the bottom; actions = extra buttons next to "Gọi" ("Đổi người", "Đổi điểm đến" of the dispatch window);
 *   onCallTracker(tracker) = "Gọi" starts a video call to the field officer (else a tel: link);
 *   onCallReceiver(receiver) = "Gọi" on the "Người nhận ca" row (none for the holder: it is them)
 */
export function DispatchTrackingView({
  plan,
  incidentId,
  citizenToken,
  variant = 'inline',
  footer = null,
  actions = null,
  onCallTracker = null,
  onCallReceiver = null,
  fetchPlan = null,
  trackerCall = true, // false on the field officer's own page (the tracker is them)
}) {
  const o = plan.origin;
  const arrived = plan.status === 'ARRIVED' || plan.status === 'DONE';
  const enRoute = plan.status === 'EN_ROUTE';
  const phone = telOf(o.phone);
  const sheet = variant === 'sheet';

  const live = useLivePosition({
    incidentId,
    citizenToken,
    enabled: enRoute,
    initial: plan.lastPosition,
    fetchPlan,
  });
  // the BE recalculates the route when the vehicle leaves it: the polled plan may carry a newer one
  const route = newer(live.route, plan.route);
  // a recalculated route starts at the vehicle: count its duration from when it was computed
  const etaFrom = route?.rerouted ? route.computedAt : plan.departedAt;
  const eta =
    etaFrom && route?.durationS != null ? new Date(etaFrom.getTime() + route.durationS * 1000) : null;
  // on the way: the polled point; arrived / done: the last point the BE kept, so the dot stays at the scene
  const position = enRoute ? live.position : arrived ? plan.lastPosition : null;
  const now = useNow(enRoute, 2000);
  const stale = enRoute && (!position?.receivedAt || now - position.receivedAt.getTime() > STALE_MS);
  const gpsChip = arrived
    ? position
      ? `Đã đến · vị trí cuối ${position.receivedAt ? CLOCK.format(position.receivedAt) : ''}`.trim()
      : null
    : !enRoute
      ? null
      : !position
        ? 'Đang chờ tín hiệu GPS…'
        : stale
          ? 'Đang kết nối lại…'
          : `GPS trực tiếp${position.speedKmh != null ? ` · ${Math.round(position.speedKmh)} km/h` : ''}`;
  const tracker = plan.tracker;
  const trackerTel = telOf(tracker?.phone) || phone;

  return (
    <div className={sheet ? styles.sheetBody : styles.wrap}>
      <div className={sheet ? styles.sheetMap : styles.mapBox}>
        <RouteMap
          origin={o}
          destination={plan.destination}
          coords={route?.coords || null}
          vehicle={position ? { ...position, stale } : null}
          citizen={plan.sosPoint}
          className={sheet ? styles.mapFill : styles.mapInline}
          padding={MAP_PADDING}
        />
        <span className={styles.statusChip}>
          {plan.statusLabel}
          {enRoute && route?.rerouted ? ' · đã tính lại đường' : ''}
        </span>
        {gpsChip && (
          <span className={`${styles.gpsChip} ${position && !stale ? styles.gpsLive : styles.gpsWait}`}>
            {gpsChip}
          </span>
        )}
      </div>

      <div className={sheet ? styles.sheetCard : styles.card}>
        <div className={styles.etaRow}>
          <div className={styles.etaMain}>
            <div className={styles.etaLabel}>{arrived ? 'Lực lượng đã tới' : 'Dự kiến tới nơi'}</div>
            <div className={styles.eta}>
              {arrived ? 'Đã tới hiện trường' : route ? formatDuration(route.durationS) : 'Đang tính...'}
            </div>
          </div>
          <div className={styles.etaSide}>
            {!arrived && eta && <b>{CLOCK.format(eta)}</b>}
            {route && !arrived && (
              <span>
                {route.estimated ? 'khoảng ' : ''}
                {formatDistance(route.distanceM)} còn lại
              </span>
            )}
          </div>
        </div>
        {!arrived && <div className={styles.delay}>{DELAY_NOTE}</div>}

        {enRoute && incidentId && (live.simulation || plan.simulation) && (
          <SimulateControl incidentId={incidentId} simulation={live.simulation || plan.simulation} />
        )}

        {plan.receiver && (
          <div className={styles.tracker}>
            <div className={styles.unitMain}>
              <div className={styles.trackerLabel}>Người nhận ca</div>
              <div className={styles.unitName}>{plan.receiver.fullName}</div>
            </div>
            {onCallReceiver && (
              <button
                type="button"
                className={styles.callBtn}
                title={`Gọi video cho ${plan.receiver.fullName}`}
                onClick={() => onCallReceiver(plan.receiver)}
              >
                Gọi
              </button>
            )}
          </div>
        )}

        {plan.assignedTo && plan.assignedTo.memberId !== plan.receiver?.memberId && (
          <div className={styles.tracker}>
            <div className={styles.unitMain}>
              <div className={styles.trackerLabel}>Cán bộ được uỷ quyền</div>
              <div className={styles.unitName}>{plan.assignedTo.fullName}</div>
            </div>
          </div>
        )}

        {tracker && (
          <div className={styles.tracker}>
            <div className={styles.unitMain}>
              <div className={styles.trackerLabel}>Người đi hiện trường</div>
              <div className={styles.unitName}>{tracker.fullName}</div>
              {tracker.badgeNumber && <div className={styles.unitSub}>Số hiệu {tracker.badgeNumber}</div>}
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
            {!trackerCall ? null : onCallTracker ? (
              <button
                type="button"
                className={styles.callBtn}
                title={`Gọi video cho ${tracker.fullName}`}
                onClick={() => onCallTracker(tracker)}
              >
                Gọi
              </button>
            ) : (
              trackerTel && (
                <a className={styles.callBtn} href={`tel:${trackerTel}`} title={`Gọi ${tracker.fullName}`}>
                  Gọi
                </a>
              )
            )}
          </div>
        )}

        <div className={styles.unit}>
          <img className={styles.unitIcon} src={STATION_ICON[o.agency] || STATION_ICON.police} alt="" />
          <div className={styles.unitMain}>
            <div className={styles.unitName}>{o.name}</div>
            <div className={styles.unitSub}>Xuất phát từ: {o.address || 'Trụ sở đơn vị'}</div>
          </div>
          {actions && !tracker && <div className={styles.actions}>{actions}</div>}
          {phone && !tracker && (
            <a className={styles.callBtn} href={`tel:${phone}`} title={`Gọi ${o.phone}`}>
              Gọi
            </a>
          )}
        </div>

        {plan.destination && (
          <div className={styles.dest}>
            <span className={styles.destDot} aria-hidden="true" />
            <span>Tới: {plan.destination.address || 'Vị trí bạn đã gửi'}</span>
          </div>
        )}
        {footer}
      </div>
    </div>
  );
}

/**
 * "Mô phỏng" (officers, any incident, step 3 of the dispatch window): the BE plays the field officer's
 * phone and drives along the route, one point every 5 s, so the live tracking can be shown without going
 * outside. The trip status is untouched: "Đã đến" is still pressed by hand (officer or citizen).
 */
/** The route computed last (null-safe). */
function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (a.computedAt?.getTime() ?? 0) >= (b.computedAt?.getTime() ?? 0) ? a : b;
}

function SimulateControl({ incidentId, simulation }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // value set by the last click, until the next poll brings the BE's own state
  const [override, setOverride] = useState(null);
  const [seen, setSeen] = useState(simulation);
  if (seen !== simulation) {
    setSeen(simulation);
    setOverride(null);
  }
  const running = override ?? simulation.running;
  if (!simulation.available && !running) return null;

  const detour = async () => {
    setBusy(true);
    try {
      const plan = await detourSimulation(incidentId);
      setOverride(!!plan?.simulation?.running);
      toast.show('Xe giả rẽ sang đường khác: chờ hệ thống tự tính lại tuyến', { tone: 'info' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    setBusy(true);
    try {
      const plan = running ? await stopSimulation(incidentId) : await startSimulation(incidentId);
      setOverride(!!plan?.simulation?.running);
      if (!running) toast.show('Đang mô phỏng xe chạy tới hiện trường (5 giây / điểm)', { tone: 'info' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.simulate}>
      <span className={styles.simulateText}>
        {running ? 'Đang mô phỏng xe chạy theo tuyến…' : 'Chạy thử xe theo tuyến, không cần điện thoại GPS'}
      </span>
      <div className={styles.simulateButtons}>
        {/* test the automatic re-routing: leave the route on purpose */}
        <button
          type="button"
          className={styles.simulateDetour}
          disabled={busy}
          onClick={detour}
          title="Xe giả rẽ phải khỏi tuyến rồi mới về hiện trường, để thử tự tính lại đường đi"
        >
          ↪ Rẽ đường khác
        </button>
        <button
          type="button"
          className={running ? styles.simulateStop : styles.simulateStart}
          disabled={busy}
          onClick={toggle}
        >
          {running ? '■ Dừng' : '▶ Mô phỏng'}
        </button>
      </div>
    </div>
  );
}
