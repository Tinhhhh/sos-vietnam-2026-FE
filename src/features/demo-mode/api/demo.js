import { api } from '@/lib/api-client';

/*
 * Demo incidents switch (be-v2), any officer / admin, shared by every account:
 *   GET /api/v1/settings/demo -> data: DemoSettings
 *   PUT /api/v1/settings/demo { generate?, hidden? } -> data: DemoSettings (a missing field is kept)
 * DemoSettings: { generate, hidden, open_count, updated_at, updated_by_name }
 *   generate = the BE creates "[DEMO]" incidents every minute; hidden = they are left out of the queue,
 *   the history and the live queue messages (open queues drop the cards at once).
 */
export async function getDemoSettings() {
  const body = await api.get('/api/v1/settings/demo');
  return body?.data;
}

export async function updateDemoSettings(patch) {
  const body = await api.put('/api/v1/settings/demo', patch);
  return body?.data;
}
