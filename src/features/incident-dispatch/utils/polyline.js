/**
 * Google encoded polyline (precision 1e-5), the format the BE stores in incident_routes.polyline
 * (and the one Google Routes returns). Coordinates here are MapLibre order: [lng, lat].
 */
export function encodePolyline(coords) {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const [lng, lat] of coords || []) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    out += encodeValue(la - prevLat) + encodeValue(ln - prevLng);
    prevLat = la;
    prevLng = ln;
  }
  return out;
}

export function decodePolyline(text) {
  const coords = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (text && i < text.length) {
    const a = readValue(text, i);
    i = a.next;
    const b = readValue(text, i);
    i = b.next;
    lat += a.value;
    lng += b.value;
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

function encodeValue(v) {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let s = '';
  while (n >= 0x20) {
    s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return s + String.fromCharCode(n + 63);
}

function readValue(text, start) {
  let result = 0;
  let shift = 0;
  let i = start;
  let b;
  do {
    b = text.charCodeAt(i++) - 63;
    result |= (b & 0x1f) << shift;
    shift += 5;
  } while (b >= 0x20);
  return { value: result & 1 ? ~(result >> 1) : result >> 1, next: i };
}
