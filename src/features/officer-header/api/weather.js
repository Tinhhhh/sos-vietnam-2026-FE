import { api } from '@/lib/api-client';

/*
 * Planned be-v2 contract (legacy server.js proxied Open-Meteo):
 *   GET /api/v1/weather/current?lat&lng
 *     -> data: { temperature, description, is_day, wind_speed }
 * Until it exists the widget shows "chưa có dữ liệu" instead of made-up numbers.
 */
export async function getCurrentWeather({ lat, lng }) {
  const body = await api.get('/api/v1/weather/current', { params: { lat, lng } });
  return body?.data ?? null;
}
