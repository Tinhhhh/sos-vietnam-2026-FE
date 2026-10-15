import { api } from '@/lib/api-client';

import { normalizeStation } from '../utils/station-model';

/*
 * Rescue stations for the command map.
 *
 * Planned be-v2 contract (not built yet):
 *   GET /api/v1/stations?province&agency&level
 *     -> data: [{ id, code, name, agency_type, level, province, ward, address, phone,
 *                 latitude, longitude, officer, email, services, facility_type }]
 *
 * Until it exists we fall back to the current endpoint
 *   GET /api/v1/stations/nearest?lat&lng&radius&limit
 * with a radius that covers the whole country. That response has no `level`,
 * so normalizeStation() guesses it from the name (see station-model.js).
 */
const VIETNAM_CENTER = { lat: 16.0, lng: 106.0 };
const WHOLE_COUNTRY_RADIUS_M = 2_000_000;
const MAX_STATIONS = 10_000;

export async function getAllStations() {
  try {
    const body = await api.get('/api/v1/stations');
    return (body?.data || []).map(normalizeStation).filter(Boolean);
  } catch (err) {
    // No HTTP status = backend unreachable: nothing to fall back to.
    if (!err.status) throw err;
  }
  const body = await api.get('/api/v1/stations/nearest', {
    params: { ...VIETNAM_CENTER, radius: WHOLE_COUNTRY_RADIUS_M, limit: MAX_STATIONS },
  });
  return (body?.data || []).map(normalizeStation).filter(Boolean);
}
