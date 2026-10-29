import { api } from '@/lib/api-client';

/*
 * Phone locks against false SOS reports (be-v2, any officer / admin):
 *   GET  /api/v1/phone-locks?active=true&pageNo=0&pageSize=5
 *     -> data: ListResponse { content: PhoneLock[] } newest first
 *   PhoneLock: { id, phone, reason, reason_label, locked_at, locked_until (null = permanent), permanent,
 *                active, lifted_at, lift_note }
 *   POST /api/v1/phone-locks/{id}/lift { note } (>= 5 characters) -> data: PhoneLock
 *     -> 409 when the lock is no longer in force
 *   GET / PUT /api/v1/phone-locks/settings { enabled } -> data: { enabled, updated_at }
 *     enabled = false: no new locks and existing locks do not block SOS (they come back when switched on).
 */
export async function getActiveLocks(limit = 5) {
  const body = await api.get('/api/v1/phone-locks', { params: { active: true, pageNo: 0, pageSize: limit } });
  return body?.data?.content || [];
}

export async function liftLock(id, note) {
  const body = await api.post(`/api/v1/phone-locks/${id}/lift`, { note });
  return body?.data;
}

export async function getPhoneLockSettings() {
  const body = await api.get('/api/v1/phone-locks/settings');
  return body?.data;
}

export async function updatePhoneLockSettings(enabled) {
  const body = await api.put('/api/v1/phone-locks/settings', { enabled });
  return body?.data;
}
