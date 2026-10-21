/**
 * Road routes from a station to the SOS point.
 *
 * For now the browser calls the public OSRM demo server (OpenStreetMap, no key). When the BE has
 * `GET /api/v1/routes` (Google Routes API, key kept on the server) only this file changes: the
 * shapes returned below stay the same.
 *
 *   routeTable(origins, dest) -> [{ distanceM, durationS } | null]   one call for many stations
 *   routeDetail(origin, dest) -> { distanceM, durationS, coords: [[lng, lat]...], provider }
 *
 * Points are { lat, lng }.
 */
const OSRM = 'https://router.project-osrm.org';
const TABLE_MAX = 40; // origins per table call (the demo server allows ~100 coordinates)
const cache = new Map();

const key = (p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`;

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough estimate when no road route is available: road ≈ 1.35 × straight line at ~35 km/h. */
export function straightEstimate(a, b) {
  const km = haversineKm(a, b) * 1.35;
  return { distanceM: Math.round(km * 1000), durationS: Math.round((km / 35) * 3600), estimated: true };
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Máy chủ chỉ đường lỗi ${res.status}`);
  const body = await res.json();
  if (body.code && body.code !== 'Ok') throw new Error(body.message || 'Không tìm được đường đi');
  return body;
}

export async function routeTable(origins, dest, { signal } = {}) {
  const out = [];
  for (let i = 0; i < origins.length; i += TABLE_MAX) {
    const chunk = origins.slice(i, i + TABLE_MAX);
    const coords = [...chunk, dest].map(key).join(';');
    const sources = chunk.map((_, j) => j).join(';');
    const cacheKey = `t|${coords}`;
    let body = cache.get(cacheKey);
    if (!body) {
      body = await getJson(
        `${OSRM}/table/v1/driving/${coords}?sources=${sources}&destinations=${chunk.length}&annotations=duration,distance`,
        signal,
      );
      cache.set(cacheKey, body);
    }
    chunk.forEach((_, j) => {
      const durationS = body.durations?.[j]?.[0];
      const distanceM = body.distances?.[j]?.[0];
      out.push(
        durationS == null ? null : { distanceM: Math.round(distanceM), durationS: Math.round(durationS) },
      );
    });
  }
  return out;
}

export async function routeDetail(origin, dest, { signal } = {}) {
  const coords = `${key(origin)};${key(dest)}`;
  const cacheKey = `r|${coords}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const body = await getJson(`${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`, signal);
  const r = body.routes?.[0];
  if (!r) throw new Error('Không tìm được đường đi');
  const result = {
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
    coords: r.geometry.coordinates,
    provider: 'OSRM',
  };
  cache.set(cacheKey, result);
  return result;
}

export function formatDistance(m) {
  if (m == null) return '—';
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatDuration(s) {
  if (s == null) return '—';
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} phút`;
  return `${Math.floor(min / 60)} giờ ${min % 60 ? `${min % 60} phút` : ''}`.trim();
}
