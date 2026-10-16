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
 *                handler: { full_name, unit_name } | null }
 *
 *   POST /api/v1/incidents/{id}/cancel        header X-SOS-Access-Token, body { reason?: CancelReason }
 *     -> data: <same as tracking>, status CANCELLED. Allowed until the incident is closed.
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

/** @param {string | null} reason one of CANCEL_REASONS codes */
export async function cancelIncident(id, token, reason) {
  const body = await api.post(
    `/api/v1/incidents/${encodeURIComponent(id)}/cancel`,
    reason ? { reason } : {},
    tokenHeader(token),
  );
  return normalizeTracking(body?.data);
}
