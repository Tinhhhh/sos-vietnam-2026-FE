import { api } from '@/lib/api-client';

import { normalizeHistoryItem, normalizeIncident } from '../utils/incident-model';

/*
 * Incident queue of the officer's unit (be-v2 picks the unit from the JWT:
 * agency + level + province + ward; ADMIN sees every unit).
 *
 *   GET /api/v1/incidents/queue?pageNo&pageSize&days   (pageSize max 100; days = only incidents reported in
 *                                                       the last N days, 1-90, omitted = all)
 *     -> data: { content: [{ id, emergency_type, status, routed_agency, routed_level, province, ward,
 *                 address, latitude, longitude, incident_tags, description, citizen_name, phone,
 *                 media_count, created_at, escalate_at, escalated_at,
 *                 handler: { account_id, full_name } | null, held_by_me, can_handle }],
 *                page_no, page_size, total_elements, total_pages, last }
 *     Active incidents only (not resolved / cancelled), newest first.
 *
 *   GET /api/v1/incidents/history?days&q&agency&pageNo&pageSize
 *     -> data: ListResponse of closed incidents (RESOLVED / CANCELLED) the caller may see, newest first:
 *        { id, emergency_type, status, status_label, routed_agency, routed_level, province, ward, address,
 *          incident_tags, citizen_name, phone, created_at, accepted_at, closed_at, cancel_reason,
 *          cancel_reason_label, handler_name, dispatch_count }
 *     days 1-90 (default 7), q = search id / citizen / phone / address / ward, agency (ADMIN only).
 *
 *   POST /api/v1/incidents/{id}/claim                -> data: <incident>   409 = taken / already holding one
 *   POST /api/v1/incidents/{id}/release  body?: { to_account_id?, note? }
 *        no to_account_id = back to the shared queue, otherwise hand over to that officer
 *   GET  /api/v1/incidents/{id}/handover-candidates -> data: [{ account_id, full_name, online, busy }]
 *   POST /api/v1/incidents/{id}/request-dispatch     -> data: <incident>  VERIFYING -> RESOLVING (holder only)
 *   POST /api/v1/incidents/{id}/escalate             -> ward incident goes to the province now (PENDING, no holder)
 *
 * Status: PENDING (waiting) -> VERIFYING (taken, checking with the citizen) -> RESOLVING (forces dispatched)
 *         -> RESOLVED; CANCELLED by the citizen / auto after 60 min with nobody taking it.
 *
 * Live updates: STOMP SUBSCRIBE /user/queue/incidents
 *     -> { event: 'INCIDENT_NEW' | 'INCIDENT_UPDATED' | 'INCIDENT_ESCALATED' | 'INCIDENT_REMOVED',
 *          incident: <same shape> }
 */
export const QUEUE_DESTINATION = '/user/queue/incidents';

const QUEUE_PAGE_SIZE = 100; // be-v2 max

/** Every page of the queue (the console shows the whole live queue; it is small). */
export async function getIncidentQueue() {
  const items = [];
  for (let pageNo = 0; ; pageNo += 1) {
    const body = await api.get('/api/v1/incidents/queue', { params: { pageNo, pageSize: QUEUE_PAGE_SIZE } });
    const page = body?.data || {};
    items.push(...(page.content || []));
    if (page.last !== false) break;
  }
  return items.map(normalizeIncident).filter(Boolean);
}

export async function claimIncident(id) {
  const body = await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/claim`);
  return normalizeIncident(body?.data);
}

/** @param {{ toAccountId?: string, note?: string }} [options] */
export async function releaseIncident(id, { toAccountId, note } = {}) {
  const payload = {};
  if (toAccountId) payload.to_account_id = toAccountId;
  if (note) payload.note = note;
  const body = await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/release`, payload);
  return normalizeIncident(body?.data);
}

export async function requestDispatch(id) {
  const body = await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/request-dispatch`);
  return normalizeIncident(body?.data);
}

/** Response is the citizen-side view; the caller reloads the queue to get the province-level card. */
export async function escalateIncident(id) {
  await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/escalate`);
}

export async function getHandoverCandidates(id) {
  const body = await api.get(`/api/v1/incidents/${encodeURIComponent(id)}/handover-candidates`);
  return (body?.data || []).map((c) => ({
    accountId: c.account_id,
    fullName: c.full_name || 'Cán bộ',
    online: c.online === true,
    busy: c.busy === true,
  }));
}

/**
 * One page of closed incidents.
 * @param {{ days: number, q?: string, agency?: string, pageNo: number, pageSize: number }} params
 *   agency = be-v2 AgencyType (POLICE | CSGT | FIRE), command centre only.
 */
export async function getIncidentHistory({ days, q, agency, pageNo, pageSize }) {
  const params = { days, pageNo, pageSize };
  if (q) params.q = q;
  if (agency) params.agency = agency;
  const body = await api.get('/api/v1/incidents/history', { params });
  const page = body?.data || {};
  return {
    items: (page.content || []).map(normalizeHistoryItem).filter(Boolean),
    total: page.total_elements || 0,
    totalPages: page.total_pages || 0,
  };
}
