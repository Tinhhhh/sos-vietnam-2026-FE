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

/*
 *   GET /api/v1/admin/accounts/export?province_id&agency&level  (all optional)
 *     -> .xlsx: sheet "Danh sách tài khoản" (+ commander, duty officer) and sheet "Cán bộ"
 *        (password / PIN columns only show seed values still in use)
 *     -> 400 JSON { message } for an unknown province / agency / level
 * The whole country takes ~10 s on the BE, so the timeout is longer than the default 15 s.
 */
export async function exportAccounts({ provinceId, agency, level } = {}) {
  const params = {};
  if (provinceId) params.province_id = provinceId;
  if (agency) params.agency = agency;
  if (level) params.level = level;
  try {
    return await api.get('/api/v1/admin/accounts/export', { params, responseType: 'blob', timeout: 180000 });
  } catch (err) {
    // with responseType blob the JSON error body arrives as a Blob, so the message is read here
    if (err.data instanceof Blob) {
      try {
        const body = JSON.parse(await err.data.text());
        if (body?.message) err.message = body.message;
      } catch {
        // not JSON: keep the generic message
      }
    }
    throw err;
  }
}

export async function getProvinces() {
  const body = await api.get('/api/v1/geo/provinces');
  return body?.data || [];
}

export async function getWardsOfProvince(provinceId) {
  const body = await api.get(`/api/v1/geo/provinces/${encodeURIComponent(provinceId)}/wards`);
  return body?.data || [];
}
