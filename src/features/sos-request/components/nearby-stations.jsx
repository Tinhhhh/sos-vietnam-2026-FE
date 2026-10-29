import { useEffect, useState } from 'react';

import { getNearbyStations } from '../api/nearby';
import styles from './nearby-stations.module.css';

/** Travel time is estimated at this speed (the distance is a straight line). */
const SPEED_KMH = 40;

const km = (m) => `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
const minutes = (m) => Math.max(1, Math.round(m / ((SPEED_KMH * 1000) / 60)));
/** first number of "0292 3820071 / 0292 3821288" for the call link */
const telOf = (phone) => (phone.split(/[/,;]| - /)[0] || '').replace(/[^\d+]/g, '');

/**
 * The 5 nearest hospitals (kind HOSPITAL) or police stations (kind POLICE) around the citizen's position:
 * name, phone (tap to call), distance and the time at 40 km/h, nearest first.
 *
 * @param {{ kind: 'HOSPITAL' | 'POLICE', location: { hasFix: boolean, coords: { lat, lng } | null } }} props
 */
export function NearbyStations({ kind, location }) {
  // answer for one position (key): a newer position shows "Đang tìm…" until its own answer arrives
  const [state, setState] = useState({ key: null, items: [], error: null });
  // ask again only when the citizen moved ~100 m, not on every GPS tick
  const key =
    location?.hasFix && location.coords
      ? `${location.coords.lat.toFixed(3)},${location.coords.lng.toFixed(3)}`
      : null;

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const [lat, lng] = key.split(',').map(Number);
    getNearbyStations({ lat, lng }, kind)
      .then((items) => alive && setState({ key, items, error: null }))
      .catch((err) => alive && setState({ key, items: [], error: err.message }));
    return () => {
      alive = false;
    };
  }, [key, kind]);

  const what = kind === 'HOSPITAL' ? 'bệnh viện' : 'cơ quan công an';
  if (!key) {
    return <div className={styles.note}>Bật định vị (GPS) để tìm {what} gần bạn nhất.</div>;
  }
  if (state.key === key && state.error) {
    return <div className={styles.error}>Không tải được danh sách: {state.error}</div>;
  }
  if (state.key !== key && !state.items.length) {
    return <div className={styles.note}>Đang tìm {what} gần bạn…</div>;
  }
  if (!state.items.length) {
    return <div className={styles.note}>Không tìm thấy {what} nào trong bán kính 50 km.</div>;
  }
  return (
    <>
      <ol className={styles.list}>
        {state.items.map((s, i) => {
          const tel = s.phone ? telOf(s.phone) : '';
          return (
            <li key={s.id} className={styles.item}>
              <span className={styles.rank} aria-hidden="true">
                {i + 1}
              </span>
              <div className={styles.main}>
                <div className={styles.name}>{s.name}</div>
                <div className={styles.meta}>
                  {km(s.distanceM)} · ~{minutes(s.distanceM)} phút
                </div>
                {s.phone ? (
                  <div className={styles.phone}>{s.phone}</div>
                ) : (
                  <div className={styles.meta}>Chưa có SĐT</div>
                )}
              </div>
              {tel && (
                <a className={styles.call} href={`tel:${tel}`} title={`Gọi ${s.name}`}>
                  Gọi
                </a>
              )}
            </li>
          );
        })}
      </ol>
      <div className={styles.note}>
        Khoảng cách đường chim bay, thời gian ước tính ở tốc độ {SPEED_KMH} km/h.
      </div>
    </>
  );
}
