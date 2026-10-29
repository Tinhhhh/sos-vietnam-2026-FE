import { api } from '@/lib/api-client';

import { normalizeTracking } from '../utils/tracking-model';

/*
 * The citizen follows their own incident with the citizen_access_token returned by POST /incidents
 * (no login). be-v2 contracts:
 *
 *   GET  /api/v1/incidents/{id}/tracking      header X-SOS-Access-Token
 *     -> data: { id, emergency_type, status, routed_agency, routed_level, province, ward,
 *                created_at, escalate_at, escalated_at, accepted_at, cancelled_at,
 *                cancel_reason, cancel_reason_label,
 *                handler: { full_name, unit_name } | null,
 *                lookup_code: 'K7M2-QX9P' | null  (only once RESOLVED; citizen re-reads the record with it
 *                + last 4 phone digits via POST /incidents/lookup) }
 *
 *   POST /api/v1/incidents/{id}/cancel        header X-SOS-Access-Token, body { reason?: CancelReason }
 *     -> data: <same as tracking>, status CANCELLED. Allowed until the incident is closed.
 *
 *   POST /api/v1/incidents/{id}/escalate      header X-SOS-Access-Token
 *     -> data: <same as tracking>, moved to the province (PENDING, no handler). Only while VERIFYING past
 *        escalate_at (an officer took it but has not dispatched forces); 409 otherwise.
 *
 * Status: PENDING -> VERIFYING (officer took it, checking) -> RESOLVING (forces dispatched) -> RESOLVED;
 *         CANCELLED (citizen / auto after 60 min with nobody).
 *
 * STOMP (CONNECT headers X-SOS-Access-Token + X-SOS-Incident-Id):
 *   SUBSCRIBE /user/queue/incident  -> { event: 'INCIDENT_UPDATED' | 'INCIDENT_ESCALATED' | 'INCIDENT_CANCELLED',
 *                                        incident: <same as tracking> }
 *   SUBSCRIBE /user/queue/calls     -> call signals from the officer holding the incident
 *   SEND      /app/calls            -> call signals { incident_id, call_id, action, sdp?, candidate?, ... }
 */
export const INCIDENT_DESTINATION = '/user/queue/incident';
export const CALLS_DESTINATION = '/user/queue/calls';
export const CALL_SEND_DESTINATION = '/app/calls';

export const CANCEL_REASONS = [
  { code: 'MISTAKE', label: 'Bấm nhầm' },
  { code: 'RESOLVED_SELF', label: 'Sự việc đã ổn' },
  { code: 'CALLED_HOTLINE', label: 'Đã gọi 113 / 114' },
  { code: 'OTHER', label: 'Lý do khác' },
];

const tokenHeader = (token) => ({ headers: { 'X-SOS-Access-Token': token } });

export async function getTracking(id, token) {
  const body = await api.get(`/api/v1/incidents/${encodeURIComponent(id)}/tracking`, tokenHeader(token));
  return normalizeTracking(body?.data);
}

export async function requestProvince(id, token) {
  const body = await api.post(
    `/api/v1/incidents/${encodeURIComponent(id)}/escalate`,
    null,
    tokenHeader(token),
  );
  return normalizeTracking(body?.data);
}

/** Citizen confirms "Đã xử lý xong" (POST dispatch-plan/confirm); with the officer's confirmation the case closes. */
export async function confirmResolved(id, token) {
  await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/dispatch-plan/confirm`, {}, tokenHeader(token));
  return getTracking(id, token);
}

/** @param {string | null} reason one of CANCEL_REASONS codes */
export async function cancelIncident(id, token, reason) {
  const body = await api.post(
    `/api/v1/incidents/${encodeURIComponent(id)}/cancel`,
    reason ? { reason } : {},
    tokenHeader(token),
  );
  return normalizeTracking(body?.data);
}
