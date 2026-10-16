import { api } from '@/lib/api-client';

/*
 * be-v2 proxies Open-Meteo like legacy server.js (OFFICER/ADMIN, cached 10 minutes):
 *   GET /api/v1/weather/current?lat&lng
 *     -> data: { temperature, description, is_day, wind_speed }
 * On 503 (Open-Meteo down) the widget shows "chưa có dữ liệu" instead of made-up numbers.
 */
export async function getCurrentWeather({ lat, lng }) {
  const body = await api.get('/api/v1/weather/current', { params: { lat, lng } });
  return body?.data ?? null;
}
