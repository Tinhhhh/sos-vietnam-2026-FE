/*
 * Field officer's link page /f/{token} (no login; be-v2 FieldController, header X-SOS-Field-Token):
 *
 *   GET  /api/v1/field/plan       -> { incident_id, incident_status, emergency_type(_label), incident_tag, description,
 *                                      citizen_name, citizen_phone, address, created_at, handler_name, plan: <plan> }
 *   POST /api/v1/field/position   { latitude, longitude, speed_kmh?, heading?, accuracy_m? } -> data: true | false
 *                                  (false = the Traccar app sent a point in the last 20 s: the app wins)
 *   POST /api/v1/field/arrive     "Đã đến" -> data: <plan>
 *
 * 401 = link replaced (re-issued / field officer changed), 410 = the case is closed.
 */
import { api } from '@/lib/api-client';

import { normalizePlan } from './dispatch-api';

const FIELD_TOKEN_HEADER = 'X-SOS-Field-Token';
const headers = (token) => ({ headers: { [FIELD_TOKEN_HEADER]: token } });
const toDate = (v) => (v ? new Date(v) : null);

export async function getFieldPlan(token) {
  const body = await api.get('/api/v1/field/plan', headers(token));
  const d = body.data || {};
  return {
    incidentId: d.incident_id,
    incidentStatus: d.incident_status,
    typeLabel: d.emergency_type_label || '',
    tag: d.incident_tag || '',
    description: d.description || '',
    citizenName: d.citizen_name || '',
    citizenPhone: d.citizen_phone || '',
    address: d.address || '',
    createdAt: toDate(d.created_at),
    handlerName: d.handler_name || '',
    plan: normalizePlan(d.plan),
  };
}

/** @param {{ lat: number, lng: number, speedKmh?: number|null, heading?: number|null, accuracyM?: number|null }} p */
export async function sendFieldPosition(token, p) {
  const body = await api.post(
    '/api/v1/field/position',
    {
      latitude: p.lat,
      longitude: p.lng,
      speed_kmh: p.speedKmh ?? null,
      heading: p.heading ?? null,
      accuracy_m: p.accuracyM ?? null,
    },
    headers(token),
  );
  return !!body.data;
}

/** "Khởi hành" from the link page (the chosen field officer sets off). */
export async function fieldDepart(token) {
  const body = await api.post('/api/v1/field/depart', null, headers(token));
  return normalizePlan(body.data);
}

/** reason: confirm without GPS (phone / GPS broken), at least 5 characters */
export async function fieldArrive(token, reason) {
  const body = await api.post('/api/v1/field/arrive', reason ? { reason } : {}, headers(token));
  return normalizePlan(body.data);
}
