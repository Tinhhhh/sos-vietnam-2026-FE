/** Small geometry helpers (no turf dependency for a handful of point-in-polygon checks). */

export function normalizeProvinceName(name) {
  return (name || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/^(thành phố|tp\.?|tỉnh)\s*/u, '')
    .trim();
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, rings) {
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(point, rings[i])) return false;
  return true;
}

export function pointInFeature(point, feature) {
  const g = feature?.geometry;
  if (!g) return false;
  if (g.type === 'Polygon') return pointInPolygon(point, g.coordinates);
  if (g.type === 'MultiPolygon') return g.coordinates.some((poly) => pointInPolygon(point, poly));
  return false;
}

export function bboxOf(feature) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    coords.forEach(visit);
  };
  visit(feature.geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

export function bboxCenter([minX, minY, maxX, maxY]) {
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Shortest distance (km) from a point to a polygon's edges; equirectangular, fine at province scale. */
export function distanceToFeatureKm([lng, lat], feature) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  const visitRing = (ring) => {
    for (let i = 1; i < ring.length; i++) {
      const ax = (ring[i - 1][0] - lng) * kx;
      const ay = (ring[i - 1][1] - lat) * ky;
      const bx = (ring[i][0] - lng) * kx;
      const by = (ring[i][1] - lat) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) best = d;
    }
  };
  const g = feature.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  polys.forEach((poly) => poly.forEach(visitRing));
  return best;
}
