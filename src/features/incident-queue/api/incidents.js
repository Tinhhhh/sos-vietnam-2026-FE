import { api } from '@/lib/api-client';

import { normalizeIncident } from '../utils/incident-model';

/*
 * Incident queue of the officer's unit (be-v2 picks the unit from the JWT:
 * agency + level + province + ward; ADMIN sees every unit).
 *
 *   GET /api/v1/incidents/queue?pageNo&pageSize   (pageSize max 100)
 *     -> data: { content: [{ id, emergency_type, status, routed_agency, routed_level, province, ward,
 *                 address, latitude, longitude, incident_tags, description, citizen_name, phone,
 *                 media_count, created_at, escalate_at, escalated_at,
 *                 handler: { account_id, full_name } | null, held_by_me, can_handle }],
 *                page_no, page_size, total_elements, total_pages, last }
 *     Active incidents only (not resolved / cancelled), newest first.
 *
 *   POST /api/v1/incidents/{id}/claim                -> data: <incident>   409 = taken / already holding one
 *   POST /api/v1/incidents/{id}/release  body?: { to_account_id?, note? }
 *        no to_account_id = back to the shared queue, otherwise hand over to that officer
 *   GET  /api/v1/incidents/{id}/handover-candidates -> data: [{ account_id, full_name, online, busy }]
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

export async function getHandoverCandidates(id) {
  const body = await api.get(`/api/v1/incidents/${encodeURIComponent(id)}/handover-candidates`);
  return (body?.data || []).map((c) => ({
    accountId: c.account_id,
    fullName: c.full_name || 'Cán bộ',
    online: c.online === true,
    busy: c.busy === true,
  }));
}
