import { api } from '@/lib/api-client';

/*
 * Văn bản báo cáo "Phiếu thông báo và tiếp nhận thông tin ứng phó sự cố khẩn cấp" (mẫu bản gốc), be-v2:
 *
 * Cán bộ (JWT, cùng phạm vi lịch sử, chỉ ca RESOLVED):
 *   GET  /api/v1/incidents/{id}/document               -> data: Document (saved=false: bản nháp BE tự điền)
 *   PUT  /api/v1/incidents/{id}/document  body Fields  -> Document (409 khi đã đủ chữ ký; sửa nội dung đã ký
 *                                                        thì BE xoá chữ ký cũ)
 *   POST /api/v1/incidents/{id}/document/sign-officer  body Sign
 *   POST /api/v1/incidents/{id}/document/sign-proxy    body Sign + { reason (>= 5), authorized: true }
 *   GET  /api/v1/incidents/{id}/document/docx          -> file .docx
 * Người dân:
 *   GET  /api/v1/incidents/{id}/document/citizen       header X-SOS-Access-Token (ca xong mà cán bộ chưa lưu:
 *                                                        bản nháp saved=false, chưa ký được)
 *   POST /api/v1/incidents/{id}/document/citizen-sign  header X-SOS-Access-Token, body Sign
 *   POST /api/v1/incidents/lookup/document             body { lookup_code, phone_last4 }
 *   POST /api/v1/incidents/lookup/document/sign        body Sign + { lookup_code, phone_last4 }
 *
 * Document = { incident_id, doc_number, saved, locked, editable, fields: Fields, latitude, longitude,
 *              officer_signature: Signature | null, citizen_signature: Signature | null,
 *              created_by_name, created_at, updated_by_name, updated_at }
 * Fields   = { header_upper, header_lower, place_date, officer_name, officer_title, unit_name, unit_address,
 *              unit_phone, reporter_name, reporter_phone, target_type, incident_time, incident_address,
 *              coordinates, description, affects_citizens, needs_help, help_request, advice_given,
 *              resolution_result }
 * Signature = { name, type: 'DRAW' | 'TYPE', image (PNG data URL), signed_at, signed_by_name,
 *               channel: 'CITIZEN' | 'OFFICER_PROXY', channel_label, proxy_reason }
 * Sign     = { name, type, signature_data? }
 */

export const FIELD_KEYS = [
  'header_upper',
  'header_lower',
  'place_date',
  'officer_name',
  'officer_title',
  'unit_name',
  'unit_address',
  'unit_phone',
  'reporter_name',
  'reporter_phone',
  'target_type',
  'incident_time',
  'incident_address',
  'coordinates',
  'description',
  'affects_citizens',
  'needs_help',
  'help_request',
  'advice_given',
  'resolution_result',
];

const path = (id) => `/api/v1/incidents/${encodeURIComponent(id)}/document`;
const tokenHeader = (token) => ({ headers: { 'X-SOS-Access-Token': token } });
const toDate = (v) => (v ? new Date(v) : null);

function normalizeSignature(s) {
  if (!s) return null;
  return {
    name: s.name || '',
    type: s.type,
    image: s.image || null,
    signedAt: toDate(s.signed_at),
    signedByName: s.signed_by_name || null,
    channel: s.channel || null,
    channelLabel: s.channel_label || null,
    proxyReason: s.proxy_reason || null,
  };
}

/** Fields stay snake_case (they go straight back in PUT); null text becomes '' for inputs. */
export function normalizeDocument(d) {
  if (!d) return null;
  const fields = {};
  FIELD_KEYS.forEach((k) => {
    const v = d.fields?.[k];
    fields[k] = typeof v === 'boolean' ? v : v == null ? '' : String(v);
  });
  if (typeof fields.affects_citizens !== 'boolean') fields.affects_citizens = true;
  if (typeof fields.needs_help !== 'boolean') fields.needs_help = true;
  return {
    incidentId: d.incident_id,
    docNumber: d.doc_number,
    saved: !!d.saved,
    locked: !!d.locked,
    editable: !!d.editable,
    fields,
    lat: d.latitude,
    lng: d.longitude,
    officerSignature: normalizeSignature(d.officer_signature),
    citizenSignature: normalizeSignature(d.citizen_signature),
    createdByName: d.created_by_name || null,
    createdAt: toDate(d.created_at),
    updatedByName: d.updated_by_name || null,
    updatedAt: toDate(d.updated_at),
  };
}

const signBody = ({ name, type, signatureData, reason, authorized }) => ({
  name,
  type,
  signature_data: type === 'DRAW' ? signatureData : null,
  ...(reason !== undefined ? { reason, authorized: !!authorized } : {}),
});

export async function getDocument(id) {
  return normalizeDocument((await api.get(path(id)))?.data);
}

export async function saveDocument(id, fields) {
  return normalizeDocument((await api.put(path(id), fields))?.data);
}

export async function signAsOfficer(id, sign) {
  return normalizeDocument((await api.post(`${path(id)}/sign-officer`, signBody(sign)))?.data);
}

export async function signForCitizen(id, sign) {
  return normalizeDocument((await api.post(`${path(id)}/sign-proxy`, signBody(sign)))?.data);
}

/** Downloads the .docx (browser save dialog). */
export async function downloadDocx(id) {
  const blob = await api.get(`${path(id)}/docx`, { responseType: 'blob', timeout: 60000 });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Phieu_TiepNhan_UPSC_${id}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Citizen access: `{ incidentId, token }` (tracking screen) or `{ lookupCode, phoneLast4 }` (Tra Cứu).
 * Resolves to null when officers have not saved a document yet (404).
 */
export async function getCitizenDocument(access) {
  try {
    const body = access.token
      ? await api.get(`${path(access.incidentId)}/citizen`, tokenHeader(access.token))
      : await api.post('/api/v1/incidents/lookup/document', {
          lookup_code: access.lookupCode,
          phone_last4: access.phoneLast4,
        });
    return normalizeDocument(body?.data);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function signAsCitizen(access, sign) {
  const body = access.token
    ? await api.post(`${path(access.incidentId)}/citizen-sign`, signBody(sign), tokenHeader(access.token))
    : await api.post('/api/v1/incidents/lookup/document/sign', {
        ...signBody(sign),
        lookup_code: access.lookupCode,
        phone_last4: access.phoneLast4,
      });
  return normalizeDocument(body?.data);
}
