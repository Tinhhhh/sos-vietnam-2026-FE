import { api } from '@/lib/api-client';

/*
 * Unit settings (be-v2), signed-in officer of a unit account:
 *   GET    /api/v1/unit/members            -> data: [UnitMember]
 *   POST   /api/v1/unit/members            { full_name, badge_number, rank, position, unit_role, phone }
 *          -> data: { member: UnitMember, activation_code, activation_expires_at }  (code shown once)
 *   PUT    /api/v1/unit/members/{id}       same body -> data: UnitMember
 *   DELETE /api/v1/unit/members/{id}       (soft: active=false; that officer's sessions end)
 *   POST   /api/v1/unit/members/{id}/reset-pin -> data: { activation_code, activation_expires_at } (also unlocks)
 *   GET    /api/v1/unit/duty               -> data: { current: DutyAssignment | null, history: [DutyAssignment] }
 *   POST   /api/v1/unit/duty               { member_id } -> data: DutyAssignment (closes the previous one now)
 * Writes: commander or the current duty officer only (403 otherwise).
 *
 * UnitMember: { member_id, full_name, badge_number, rank, rank_label, position, unit_role: COMMANDER|MEMBER,
 *               phone, activated, locked, is_duty_officer }
 * DutyAssignment: { id, member_id, full_name, rank_label, assigned_by_name, started_at, ended_at }
 */
export async function getMembers() {
  const body = await api.get('/api/v1/unit/members');
  return body?.data || [];
}

export async function createMember(payload) {
  const body = await api.post('/api/v1/unit/members', payload);
  return body?.data;
}

export async function updateMember(id, payload) {
  const body = await api.put(`/api/v1/unit/members/${encodeURIComponent(id)}`, payload);
  return body?.data;
}

export async function deleteMember(id) {
  await api.delete(`/api/v1/unit/members/${encodeURIComponent(id)}`);
}

export async function resetMemberPin(id) {
  const body = await api.post(`/api/v1/unit/members/${encodeURIComponent(id)}/reset-pin`);
  return body?.data;
}

export async function getDuty() {
  const body = await api.get('/api/v1/unit/duty');
  return body?.data || { current: null, history: [] };
}

export async function assignDuty(memberId) {
  const body = await api.post('/api/v1/unit/duty', { member_id: memberId });
  return body?.data;
}
