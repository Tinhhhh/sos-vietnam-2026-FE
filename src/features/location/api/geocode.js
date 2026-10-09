import { api } from '@/lib/api-client';

/*
 * Backend contracts used by the location feature.
 *
 * be-v2 today:   GET /api/geo/resolve?lat&lng -> { ok, data: { ward, province, provinceCode? } }
 * Not yet in be-v2 (legacy server.js had them; the UI falls back gracefully):
 *   GET /api/geocode/reverse?lat&lng -> { ok, address }
 *   GET /api/geocode/ip              -> { ok, lat, lng, address, city }
 */

export async function getReverseGeocode({ lat, lng }) {
  const data = await api.get('/api/geocode/reverse', { params: { lat, lng } });
  return data?.address || null;
}

export async function getIpLocation() {
  const data = await api.get('/api/geocode/ip');
  if (!data?.ok) return null;
  return {
    coords: { lat: data.lat, lng: data.lng },
    address: data.address || `${data.city}, Việt Nam`,
  };
}

/** Administrative area (ward/province) containing the point, or null when unknown. */
export async function resolveJurisdiction({ lat, lng }) {
  const res = await api.get('/api/geo/resolve', { params: { lat, lng } });
  const area = res?.data;
  // Without provinceCode the backend only returns its "outside boundaries" placeholder.
  if (!res?.ok || !area?.provinceCode) return null;
  return { ward: area.ward || '', province: area.province || '' };
}
