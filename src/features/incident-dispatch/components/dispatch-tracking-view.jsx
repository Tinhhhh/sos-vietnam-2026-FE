import { formatDistance, formatDuration } from '../api/routing';
import { STATION_ICON } from '../utils/origin-candidates';
import styles from './dispatch-tracking.module.css';
import { RouteMap } from './route-map';

const CLOCK = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const DELAY_NOTE = 'Thời gian thực tế có thể lâu hơn do ùn tắc giao thông hoặc thời tiết không thuận lợi.';
const MAP_PADDING = { top: 56, bottom: 28, left: 36, right: 36 }; // room for the status chip

/**
 * "Theo dõi" like a ride-hailing app: map with the station emblem, the SOS point and the route,
 * then a card with the unit, ETA, distance and a call button. Used by the citizen's tracking sheet
 * and step 3 of the officer's dispatch window.
 *
 * The moving vehicle (GPS of the dispatched officer) comes in a later batch; until then the unit is
 * shown at its station and the arrival time is departure + estimated duration.
 *
 * @param {{ plan: object, variant?: 'inline' | 'sheet', footer?: React.ReactNode }} props  plan from normalizePlan();
 *   sheet = fills its (full-screen) parent: map takes the free height, the card sits at the bottom
 */
export function DispatchTrackingView({ plan, variant = 'inline', footer = null }) {
  const o = plan.origin;
  const route = plan.route;
  const eta =
    plan.departedAt && route?.durationS != null
      ? new Date(plan.departedAt.getTime() + route.durationS * 1000)
      : null;
  const arrived = plan.status === 'ARRIVED' || plan.status === 'DONE';
  const phone = (o.phone || '').replace(/[^0-9+]/g, '');
  const sheet = variant === 'sheet';

  return (
    <div className={sheet ? styles.sheetBody : styles.wrap}>
      <div className={sheet ? styles.sheetMap : styles.mapBox}>
        <RouteMap
          origin={o}
          destination={plan.destination}
          coords={route?.coords || null}
          className={sheet ? styles.mapFill : styles.mapInline}
          padding={MAP_PADDING}
        />
        <span className={styles.statusChip}>{plan.statusLabel}</span>
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

        <div className={styles.unit}>
          <img className={styles.unitIcon} src={STATION_ICON[o.agency] || STATION_ICON.police} alt="" />
          <div className={styles.unitMain}>
            <div className={styles.unitName}>{o.name}</div>
            <div className={styles.unitSub}>Xuất phát từ: {o.address || 'Trụ sở đơn vị'}</div>
          </div>
          {phone && (
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
