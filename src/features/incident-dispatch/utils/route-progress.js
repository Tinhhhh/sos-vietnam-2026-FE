/**
 * Where the vehicle is along its route, to grey out the part already driven (like Grab).
 * Routes are [[lng, lat]...]. Distances use a flat projection around the vehicle: fine for a few km.
 */
const M_PER_DEG = 111_320;

function project(p, a, b) {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = (a[0] - p[0]) * k;
  const ay = a[1] - p[1];
  const dx = (b[0] - a[0]) * k;
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / len));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return {
    t,
    distM: Math.hypot(x, y) * M_PER_DEG,
    point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
  };
}

/**
 * Nearest point of the route to the vehicle, searching only from `fromIndex` on so a route that passes near
 * itself never jumps back. Returns null when the vehicle is farther than `maxOffM` from the route (off route,
 * GPS noise): the caller keeps the previous split.
 * @returns {{ index: number, point: number[] } | null}  index = segment start (coords[index] -> coords[index + 1])
 */
export function locateOnRoute(coords, vehicle, { fromIndex = 0, maxOffM = 80 } = {}) {
  if (!coords || coords.length < 2 || !vehicle) return null;
  const p = [vehicle.lng, vehicle.lat];
  let best = null;
  for (let i = Math.max(0, fromIndex); i < coords.length - 1; i += 1) {
    const r = project(p, coords[i], coords[i + 1]);
    if (!best || r.distM < best.distM) best = { index: i, point: r.point, distM: r.distM };
  }
  return best && best.distM <= maxOffM ? { index: best.index, point: best.point } : null;
}

/** Driven part (grey) and remaining part (green) of the route, split at the vehicle's position on it. */
export function splitRoute(coords, at) {
  if (!coords || coords.length < 2 || !at) return { done: null, rest: coords };
  return {
    done: [...coords.slice(0, at.index + 1), at.point],
    rest: [at.point, ...coords.slice(at.index + 1)],
  };
}
