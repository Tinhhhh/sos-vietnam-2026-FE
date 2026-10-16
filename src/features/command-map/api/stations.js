import { api } from '@/lib/api-client';

import { normalizeStation } from '../utils/station-model';

/*
 * Rescue stations for the command map.
 *
 *   GET /api/v1/stations?pageNo&pageSize&province&agency&level&sortBy&sortDir
 *     pageNo from 0, pageSize 1-1000; province = part of the name, case-insensitive ("c" -> Cần Thơ, Cà Mau...)
 *     agency: POLICE | CSGT | FIRE | HOSPITAL, level: NATIONAL | PROVINCE | WARD | ENTERPRISE (null = unknown)
 *     -> data: { content: [{ id, name, agency_type, level, province, ward, address, phone,
 *                            latitude, longitude, officer, email, services, facility_type }],
 *                page_no, page_size, total_elements, total_pages, last }
 *
 * The map needs every station, so getAllStations() reads page 0, then the other pages in parallel.
 * If it fails with an HTTP error (older backend) we fall back to
 *   GET /api/v1/stations/nearest?lat&lng&radius&limit
 * with a radius that covers the whole country. That response has no `level`,
 * so normalizeStation() guesses it from the name (see station-model.js).
 */
const PAGE_SIZE = 1000; // be-v2 max
const VIETNAM_CENTER = { lat: 16.0, lng: 106.0 };
const WHOLE_COUNTRY_RADIUS_M = 2_000_000;
const MAX_STATIONS = 10_000;

const getStationsPage = (pageNo) =>
  api.get('/api/v1/stations', { params: { pageNo, pageSize: PAGE_SIZE } }).then((body) => body?.data);

export async function getAllStations() {
  try {
    const first = await getStationsPage(0);
    const rest = await Promise.all(
      Array.from({ length: Math.max((first?.total_pages || 1) - 1, 0) }, (_, i) => getStationsPage(i + 1)),
    );
    return [first, ...rest]
      .flatMap((page) => page?.content || [])
      .map(normalizeStation)
      .filter(Boolean);
  } catch (err) {
    // No HTTP status = backend unreachable: nothing to fall back to.
    if (!err.status) throw err;
  }
  const body = await api.get('/api/v1/stations/nearest', {
    params: { ...VIETNAM_CENTER, radius: WHOLE_COUNTRY_RADIUS_M, limit: MAX_STATIONS },
  });
  return (body?.data || []).map(normalizeStation).filter(Boolean);
}
