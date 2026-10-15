import { api } from '@/lib/api-client';

/*
 * Administrative boundaries.
 *
 * Polygons are static files in public/assets/geo (same files be-v2 seeds its DB
 * from). Lists come from be-v2:
 *   GET /api/v1/geo/provinces              -> data: [{ code, name, name_en, center_lat, center_lng }]
 *   GET /api/v1/geo/wards?provinceCode     -> data: [{ id, malk, name, province_code, province_name, sap_nhap_tu, center_lat, center_lng }]
 *
 * Planned (not built yet), read-only data status for every officer:
 *   GET /api/v1/geo/data-status
 *     -> data: [{ dataset: 'boundaries' | 'rescue_stations', version, updated_at, checked_at, total }]
 */
const GEO_BASE = '/assets/geo';

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`);
  return res.json();
}

export const getProvinceShapes = () => getJson(`${GEO_BASE}/vn-provinces.geojson`);
export const getProvinceLabels = () => getJson(`${GEO_BASE}/vn-province-labels.geojson`);
export const getWardShapes = () => getJson(`${GEO_BASE}/vn-wards-simplified.geojson`);

export async function getProvinces() {
  const body = await api.get('/api/v1/geo/provinces');
  return body?.data || [];
}

export async function getWardsOfProvince(provinceCode) {
  const body = await api.get('/api/v1/geo/wards', { params: { provinceCode } });
  return body?.data || [];
}

/** @returns {Promise<object[]|null>} null when the endpoint is not available yet */
export async function getDataStatus() {
  try {
    const body = await api.get('/api/v1/geo/data-status');
    return body?.data || [];
  } catch {
    return null;
  }
}
