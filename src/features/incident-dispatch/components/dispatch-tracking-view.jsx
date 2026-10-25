import { useNow } from '@/hooks/use-now';

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
 * every 5 s); then a card with the field officer ("Lực lượng phụ trách": name, badge, call), the unit,
 * ETA and distance. Used by the citizen's tracking sheet, the ward card and step 3 of the dispatch window.
 *
 * @param {{ plan: object, incidentId?: string, citizenToken?: string, variant?: 'inline' | 'sheet',
 *           footer?: React.ReactNode }} props  plan from normalizePlan(); incidentId enables the live GPS;
 *   sheet = fills its (full-screen) parent: map takes the free height, the card sits at the bottom
 */
export function DispatchTrackingView({ plan, incidentId, citizenToken, variant = 'inline', footer = null }) {
  const o = plan.origin;
  const route = plan.route;
  const eta =
    plan.departedAt && route?.durationS != null
      ? new Date(plan.departedAt.getTime() + route.durationS * 1000)
      : null;
  const arrived = plan.status === 'ARRIVED' || plan.status === 'DONE';
  const enRoute = plan.status === 'EN_ROUTE';
  const phone = telOf(o.phone);
  const sheet = variant === 'sheet';

  const position = useLivePosition({
    incidentId,
    citizenToken,
    enabled: enRoute,
    initial: plan.lastPosition,
  });
  const now = useNow(enRoute, 2000);
  const stale = !position?.receivedAt || now - position.receivedAt.getTime() > STALE_MS;
  const gpsChip = !enRoute
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
          className={sheet ? styles.mapFill : styles.mapInline}
          padding={MAP_PADDING}
        />
        <span className={styles.statusChip}>{plan.statusLabel}</span>
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

        {tracker && (
          <div className={styles.tracker}>
            <div className={styles.unitMain}>
              <div className={styles.trackerLabel}>Lực lượng phụ trách</div>
              <div className={styles.unitName}>{tracker.fullName}</div>
              {tracker.badgeNumber && <div className={styles.unitSub}>Số hiệu {tracker.badgeNumber}</div>}
            </div>
            {trackerTel && (
              <a className={styles.callBtn} href={`tel:${trackerTel}`} title={`Gọi ${tracker.fullName}`}>
                Gọi
              </a>
            )}
          </div>
        )}

        <div className={styles.unit}>
          <img className={styles.unitIcon} src={STATION_ICON[o.agency] || STATION_ICON.police} alt="" />
          <div className={styles.unitMain}>
            <div className={styles.unitName}>{o.name}</div>
            <div className={styles.unitSub}>Xuất phát từ: {o.address || 'Trụ sở đơn vị'}</div>
          </div>
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
