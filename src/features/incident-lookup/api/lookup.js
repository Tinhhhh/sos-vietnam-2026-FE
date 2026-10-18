import { api } from '@/lib/api-client';

/*
 * Citizen looks up a past incident (no login), be-v2:
 *   POST /api/v1/incidents/lookup   body { lookup_code: 'K7M2-QX9P', phone_last4: '5678' }
 *     -> data: { lookup_code, emergency_type, emergency_type_label, status, status_label, incident_tags,
 *                address, ward, province, handling_unit, created_at, accepted_at, escalated_at,
 *                cancelled_at, cancel_reason_label,
 *                dispatches: [{ station_name, agency_label, phone, dispatched_at }] }
 *     -> 404 "Mã tra cứu hoặc số điện thoại không đúng" (same message for a wrong code or a wrong phone)
 * The code is shown on the tracking screen once the incident is RESOLVED. Sent in the body, never the URL.
 */
export async function lookupIncident(lookupCode, phoneLast4) {
  const body = await api.post('/api/v1/incidents/lookup', {
    lookup_code: lookupCode,
    phone_last4: phoneLast4,
  });
  return body?.data;
}

/** Keeps only code characters and inserts the dash: "k7m2qx9p" -> "K7M2-QX9P". */
export function formatCodeInput(value) {
  const raw = value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}
