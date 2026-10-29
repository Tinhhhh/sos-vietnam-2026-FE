import { api } from '@/lib/api-client';

/*
 * Public (no login), for the citizen SOS screen:
 *   GET /api/v1/stations/nearby?lat&lng&kind=HOSPITAL|POLICE
 *     -> data: [{ id, name, level, phone, address, latitude, longitude, distance_m }]
 *   Up to 5 within 50 km, nearest first; distance_m is the straight line from the citizen.
 */
export async function getNearbyStations({ lat, lng }, kind) {
  const body = await api.get('/api/v1/stations/nearby', { params: { lat, lng, kind } });
  return (body?.data || []).map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone || '',
    address: s.address || '',
    lat: s.latitude,
    lng: s.longitude,
    distanceM: s.distance_m,
  }));
}
