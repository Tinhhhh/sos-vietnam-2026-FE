/**
 * Address search for correcting the SOS destination (GPS off, or the citizen gave a street address).
 * Temporary: OpenStreetMap Nominatim straight from the browser, Vietnam only. Moves behind the BE
 * (Google Geocoding) together with routing.
 *
 *   searchAddress(text) -> [{ label, lat, lng }]
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export async function searchAddress(text, { signal, near } = {}) {
  const q = text.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    countrycodes: 'vn',
    limit: '6',
    'accept-language': 'vi',
  });
  if (near) {
    // Prefer results around the incident (~0.3° box), without excluding the rest
    const d = 0.3;
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`${NOMINATIM}?${params}`, { signal });
  if (!res.ok) throw new Error(`Tìm địa chỉ lỗi ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

/**
 * Address of a point picked on the map ("112 Nguyễn Văn Linh, Phường An Khánh, Cần Thơ"), or null.
 * Same temporary source as searchAddress (Nominatim reverse).
 */
export async function reverseGeocode({ lat, lng }, { signal } = {}) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    zoom: '18',
    'accept-language': 'vi',
  });
  const res = await fetch(`${NOMINATIM.replace('/search', '/reverse')}?${params}`, { signal });
  if (!res.ok) return null;
  const r = await res.json();
  const a = r.address || {};
  const street = [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean).join(' ');
  const area = a.suburb || a.quarter || a.neighbourhood || a.village;
  const city = a.city || a.town || a.state;
  const short = [street || a.amenity || a.building, area, city].filter(Boolean).join(', ');
  return short || r.display_name || null;
}
