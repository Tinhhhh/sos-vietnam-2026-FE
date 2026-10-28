import { api } from '@/lib/api-client';

import { env } from '@/config/env';

import { cleanTags, normalizeHistoryItem, normalizeIncident } from '../utils/incident-model';

/*
 * Incident queue of the officer's unit (be-v2 picks the unit from the JWT:
 * agency + level + province + ward; ADMIN sees every unit).
 *
 *   GET /api/v1/incidents/queue?pageNo&pageSize&days   (pageSize max 100; days = only incidents reported in
 *                                                       the last N days, 1-90, omitted = all)
 *     -> data: { content: [{ id, emergency_type, status, routed_agency, routed_level, province, ward,
 *                 address, latitude, longitude, incident_tags, description, citizen_name, phone,
 *                 media_count, created_at, escalate_at, escalated_at,
 *                 handler: { member_id, full_name } | null, held_by_me, can_handle }],
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
 *   GET /api/v1/incidents/{id}   (same scope as the queue, 403 outside it)
 *     -> data: { id, emergency_type(_label), status(_label), incident_tags, description, citizen_name, phone, address,
 *                ward, province, latitude, longitude, accuracy, routed_agency, routed_level, handling_unit,
 *                created_at, accepted_at, escalate_at, escalated_at, cancelled_at, cancel_reason(_label), updated_at,
 *                media: [{ type: IMAGE|VIDEO|AUDIO|CALL_RECORDING, url, original_name, content_type, size }],
 *                dispatches: [{ station_name, agency_label, phone, dispatched_by, note, dispatched_at }],
 *                claims: [{ officer_name, claimed_at, released_at, end_reason_label, handed_to_name, note }] }
 *     media url = GET /api/v1/incidents/{id}/media/{file} (public, R2 redirects to a signed link)
 *
 *   POST /api/v1/incidents/{id}/claim                -> data: <incident>   409 = taken / already holding one
 *   POST /api/v1/incidents/{id}/release  body?: { to_member_id?, note? }
 *        no to_member_id = back to the shared queue, otherwise hand over to that officer
 *   GET  /api/v1/incidents/{id}/handover-candidates -> data: [{ member_id, full_name, online, busy }]
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

/** @param {{ toMemberId?: string, note?: string }} [options] */
export async function releaseIncident(id, { toMemberId, note } = {}) {
  const payload = {};
  if (toMemberId) payload.to_member_id = toMemberId;
  if (note) payload.note = note;
  const body = await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/release`, payload);
  return normalizeIncident(body?.data);
}

/** The field officer is picked later, in step 2 "Điều động" of the dispatch window. */
export async function requestDispatch(id) {
  const body = await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/request-dispatch`);
  return normalizeIncident(body?.data);
}

/** Response is the citizen-side view; the caller reloads the queue to get the province-level card. */
/**
 * Officer holding a VERIFYING incident moves it to another force (the citizen picked the wrong one):
 *   POST /api/v1/incidents/{id}/transfer  body { agency: 'POLICE' | 'CSGT' | 'FIRE', reason (5-500) }
 *   -> the incident goes back to PENDING in that force's queue; the old force's queues drop the card.
 */
export async function transferIncident(id, agency, reason) {
  await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/transfer`, { agency, reason });
}

/** Officer holding a ward incident moves it to the province; reason (5-500 characters) is required. */
export async function escalateIncident(id, reason) {
  await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/escalate`, { reason });
}

export async function getHandoverCandidates(id) {
  const body = await api.get(`/api/v1/incidents/${encodeURIComponent(id)}/handover-candidates`);
  return (body?.data || []).map((c) => ({
    memberId: c.member_id,
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

const toDate = (v) => (v ? new Date(v) : null);

/** Everything the "Chi tiết" box shows about one incident (dates as Date, media urls absolute). */
export async function getIncidentDetail(id) {
  const body = await api.get(`/api/v1/incidents/${encodeURIComponent(id)}`);
  const d = body?.data;
  if (!d) return null;
  return {
    id: d.id,
    type: d.emergency_type,
    typeLabel: d.emergency_type_label,
    status: d.status,
    statusLabel: d.status_label,
    tags: cleanTags(d.incident_tags),
    description: d.description || '',
    citizenName: d.citizen_name || '',
    phone: d.phone || '',
    address: d.address || '',
    ward: d.ward || '',
    province: d.province || '',
    lat: d.latitude,
    lng: d.longitude,
    accuracy: d.accuracy,
    handlingUnit: d.handling_unit,
    createdAt: toDate(d.created_at),
    acceptedAt: toDate(d.accepted_at),
    escalateAt: toDate(d.escalate_at),
    escalatedAt: toDate(d.escalated_at),
    escalationReasonLabel: d.escalation_reason_label || null,
    // report_type: SELF (tự báo) / PROXY (báo hộ, chưa mở); ca cũ BE điền SELF
    reportType: d.report_type || 'SELF',
    reportTypeLabel: d.report_type_label || 'Tự báo',
    // false alarms from the same IP in the last 24 h (warning only, IPs are shared on 4G)
    ipFalseAlarmCount: d.ip_false_alarm_count || 0,
    transferredFromLabel: d.transferred_from_label || null,
    transferReason: d.transfer_reason || null,
    escalationNote: d.escalation_note || null,
    cancelledAt: toDate(d.cancelled_at),
    cancelReasonLabel: d.cancel_reason_label || null,
    updatedAt: toDate(d.updated_at),
    media: (d.media || []).map((m) => ({
      type: m.type,
      url: `${env.API_URL}${m.url}`,
      name: m.original_name || '',
      contentType: m.content_type || '',
      size: m.size || 0,
    })),
    dispatches: (d.dispatches || []).map((x) => ({
      stationName: x.station_name,
      agencyLabel: x.agency_label,
      phone: x.phone,
      dispatchedBy: x.dispatched_by,
      note: x.note,
      dispatchedAt: toDate(x.dispatched_at),
    })),
    claims: (d.claims || []).map((c) => ({
      officerName: c.officer_name,
      claimedAt: toDate(c.claimed_at),
      releasedAt: toDate(c.released_at),
      endReasonLabel: c.end_reason_label,
      handedToName: c.handed_to_name,
      note: c.note,
    })),
  };
}

/*
 * GET /api/v1/officers/status?level&province_id&ward_id&agency&online&pageNo&pageSize
 *   OFFICER: always own unit incl. self (unit filters ignored). ADMIN: one unit, level=PROVINCE|WARD +
 *   province_id (+ ward_id for WARD), agency optional; missing / wrong -> 400. online=true: only online.
 *   -> data: ListResponse { content: [{ member_id, full_name, email, phone, agency_type, unit_level,
 *               unit_label, province, ward, online, busy, is_me,
 *               held_incident: { id, status, status_label, emergency_type } | null }],
 *             page_no, page_size, total_elements, total_pages, last }
 *   online = has the command console open (STOMP), busy = holds an incident. pageSize max 100.
 */
export async function getOfficerStatus({
  level,
  provinceId,
  wardId,
  agency,
  online,
  pageNo = 0,
  pageSize = 50,
} = {}) {
  const params = { pageNo, pageSize };
  if (level) params.level = level;
  if (provinceId) params.province_id = provinceId;
  if (wardId) params.ward_id = wardId;
  if (agency) params.agency = agency;
  if (online) params.online = true;
  const body = await api.get('/api/v1/officers/status', { params });
  const data = body?.data || {};
  const items = (data.content || []).map((o) => ({
    memberId: o.member_id,
    fullName: o.full_name || 'Cán bộ',
    email: o.email,
    phone: o.phone || '',
    unitLabel: o.unit_label || '',
    ward: o.ward || '',
    province: o.province || '',
    online: o.online === true,
    busy: o.busy === true,
    isMe: o.is_me === true,
    heldIncident: o.held_incident
      ? { id: o.held_incident.id, status: o.held_incident.status, statusLabel: o.held_incident.status_label }
      : null,
  }));
  return {
    items,
    total: data.total_elements ?? items.length,
    pageNo: data.page_no ?? 0,
    totalPages: data.total_pages ?? 1,
  };
}

/* Area pickers of the ADMIN officer filter (public):
 *   GET /api/v1/geo/provinces -> [{ code, name }], GET /api/v1/geo/provinces/{id}/wards -> [{ id, name }] */
export async function getProvinceOptions() {
  const body = await api.get('/api/v1/geo/provinces');
  return (body?.data || []).map((p) => ({ id: p.code, name: p.name }));
}

export async function getWardOptions(provinceId) {
  const body = await api.get(`/api/v1/geo/provinces/${encodeURIComponent(provinceId)}/wards`);
  return (body?.data || []).map((w) => ({ id: w.id, name: w.name }));
}

/**
 * Officer holding the case cancels it at any step (reason 5-255): CANCELLED. falseAlarm = "Báo khống": counts
 * towards locking the reporter's phone (3 in 24 h -> 24 h lock, 3rd lock in 30 days -> permanent).
 */
export async function cancelByOfficer(id, reason, { falseAlarm = false } = {}) {
  await api.post(`/api/v1/incidents/${encodeURIComponent(id)}/officer-cancel`, {
    reason,
    false_alarm: falseAlarm,
  });
}
