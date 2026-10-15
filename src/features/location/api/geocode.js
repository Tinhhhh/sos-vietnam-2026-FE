import { api } from '@/lib/api-client';

/*
 * Backend contracts used by the location feature.
 *
 * be-v2 today:   GET /api/v1/geo/resolve?lat&lng
 *                 -> { http_status, message, data: { ward, province, province_code, sap_nhap_tu } }
 *                 province_code = null khi toạ độ nằm ngoài ranh giới đã có dữ liệu.
 * Not yet in be-v2 (legacy server.js had them; the UI falls back gracefully):
 *   GET /api/v1/geocode/reverse?lat&lng -> { ok, address }
 *   GET /api/v1/geocode/ip              -> { ok, lat, lng, address, city }
 */

export async function getReverseGeocode({ lat, lng }) {
  const data = await api.get('/api/v1/geocode/reverse', { params: { lat, lng } });
  return data?.address || null;
}

export async function getIpLocation() {
  const data = await api.get('/api/v1/geocode/ip');
  if (!data?.ok) return null;
  return {
    coords: { lat: data.lat, lng: data.lng },
    address: data.address || `${data.city}, Việt Nam`,
  };
}

/** Administrative area (ward/province) containing the point, or null when unknown. */
export async function resolveJurisdiction({ lat, lng }) {
  const body = await api.get('/api/v1/geo/resolve', { params: { lat, lng } });
  const area = body?.data;
  // Without province_code the backend only returns its "outside boundaries" placeholder.
  if (!area?.province_code) return null;
  return { ward: area.ward || '', province: area.province || '' };
}
