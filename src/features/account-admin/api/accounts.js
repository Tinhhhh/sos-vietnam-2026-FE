import { api } from '@/lib/api-client';

/*
 * ADMIN account management (be-v2):
 *   POST /api/v1/admin/accounts
 *     body: { last_name, first_name, email, password, phone?, address?, role_name: 'OFFICER' | 'ADMIN',
 *             agency_type?, unit_level?, province_id, ward_id }
 *     -> 201 data: AccountInfoResponse (+ full_address = address, ward, province)
 *     -> 400 validation: data = { lastName: msg, ... } (Java field names), 409 email exists
 *   address holds only the detail part (house number, street); ward/province come from the ids.
 *
 * Area pickers (public):
 *   GET /api/v1/geo/provinces           -> data: [{ code, name }]
 *   GET /api/v1/geo/provinces/{provinceId}/wards  -> data: [{ id, name, province_id, province }] (sorted by name)
 */
export async function createAccount(payload) {
  const body = await api.post('/api/v1/admin/accounts', payload);
  return body?.data;
}

export async function getProvinces() {
  const body = await api.get('/api/v1/geo/provinces');
  return body?.data || [];
}

export async function getWardsOfProvince(provinceId) {
  const body = await api.get(`/api/v1/geo/provinces/${encodeURIComponent(provinceId)}/wards`);
  return body?.data || [];
}
