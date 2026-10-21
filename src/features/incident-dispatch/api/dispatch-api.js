/**
 * Dispatch plan of an incident (be-v2, V5):
 *
 *   GET /api/v1/incidents/{id}/dispatch-plan   officer JWT, or the citizen with header X-SOS-Access-Token
 *       -> data: <plan> | null (no starting station chosen yet)
 *   GET  .../dispatch-plan/candidates          officers of the chosen ward station's unit (step 2)
 *   POST .../dispatch-plan/delegate { account_id }   "Lập tức liên hệ": hand it to that officer
 *   POST .../dispatch-plan/withdraw   delegating officer takes back an unanswered delegation
 *   POST .../dispatch-plan/accept | reject { reason } | depart   the assigned (ward) officer
 *   POST .../dispatch-plan/confirm   step 4 "đã xử lý xong" (unit on site JWT, or the citizen token)
 *   POST .../dispatch-plan/finish { result, summary, forces, note, force }   closing report -> RESOLVED
 *   POST .../dispatch-plan/arrive   "Khởi hành ngay": at the scene, step 4 (assigned officer, or holder of own unit)
 *   PUT /api/v1/incidents/{id}/dispatch-plan   officer holding the case (RESOLVING)
 *       body { station_id, destination { latitude, longitude, address, source }, route { distance_m,
 *              duration_s, polyline, provider }, delegate }
 *
 * <plan> = { dispatch_id, status, status_label, step (1..4), needs_delegation,
 *            station { id, name, agency_type, level, address, phone, latitude, longitude },
 *            destination { latitude, longitude, address, source },
 *            route { origin { latitude, longitude }, distance_m, duration_s, duration_traffic_s, polyline, provider },
 *            dispatched_at, departed_at, arrived_at }
 *
 * normalizePlan() turns it into the shape the UI uses (camelCase, { lat, lng } points, route coords).
 */
import { api } from '@/lib/api-client';

import { decodePolyline, encodePolyline } from '../utils/polyline';

const AGENCY_BY_TYPE = { POLICE: 'police', CSGT: 'csgt', FIRE: 'fire', HOSPITAL: 'hospital' };
const CITIZEN_TOKEN_HEADER = 'X-SOS-Access-Token';

const point = (p) =>
  p && p.latitude != null
    ? { lat: p.latitude, lng: p.longitude, address: p.address || '', source: p.source }
    : null;
const toDate = (v) => (v ? new Date(v) : null);

export function normalizePlan(raw) {
  if (!raw) return null;
  const s = raw.station || {};
  return {
    dispatchId: raw.dispatch_id,
    status: raw.status,
    statusLabel: raw.status_label,
    step: raw.step || 1,
    needsDelegation: !!raw.needs_delegation,
    origin: {
      stationId: String(s.id),
      name: s.name,
      agency: AGENCY_BY_TYPE[s.agency_type] || 'police',
      level: s.level ? String(s.level).toLowerCase() : null,
      address: s.address || '',
      phone: s.phone || '',
      lat: s.latitude,
      lng: s.longitude,
    },
    destination: point(raw.destination),
    route: raw.route
      ? {
          distanceM: raw.route.distance_m,
          durationS: raw.route.duration_s,
          durationTrafficS: raw.route.duration_traffic_s,
          coords: raw.route.polyline ? decodePolyline(raw.route.polyline) : null,
          provider: raw.route.provider,
          estimated: raw.route.provider === 'ESTIMATE',
        }
      : null,
    assignedTo: raw.assigned_to
      ? {
          accountId: raw.assigned_to.account_id,
          fullName: raw.assigned_to.full_name,
          phone: raw.assigned_to.phone || '',
        }
      : null,
    rejectReason: raw.reject_reason || null,
    officerConfirmedAt: toDate(raw.officer_confirmed_at),
    citizenConfirmedAt: toDate(raw.citizen_confirmed_at),
    respondedAt: toDate(raw.responded_at),
    dispatchedAt: toDate(raw.dispatched_at),
    departedAt: toDate(raw.departed_at),
    arrivedAt: toDate(raw.arrived_at),
  };
}

/** @param {{ citizenToken?: string }} [opts] the citizen's tracking screen passes its access token */
export async function getDispatchPlan(incidentId, { citizenToken } = {}) {
  const body = await api.get(`/api/v1/incidents/${encodeURIComponent(incidentId)}/dispatch-plan`, {
    headers: citizenToken ? { [CITIZEN_TOKEN_HEADER]: citizenToken } : undefined,
  });
  return normalizePlan(body.data);
}

/**
 * @param {{ stationId: string, destination: {lat,lng,address,source}, route?: {distanceM,durationS,coords,provider,estimated},
 *           delegate: boolean }} plan
 */
export async function saveDispatchPlan(incidentId, { stationId, destination, route, delegate }) {
  const body = await api.put(`/api/v1/incidents/${encodeURIComponent(incidentId)}/dispatch-plan`, {
    station_id: Number(stationId),
    destination: {
      latitude: destination.lat,
      longitude: destination.lng,
      address: (destination.address || '').slice(0, 500),
      source: destination.source,
    },
    route: route
      ? {
          distance_m: route.distanceM ?? null,
          duration_s: route.durationS ?? null,
          polyline: route.coords?.length ? encodePolyline(route.coords) : null,
          provider: route.estimated ? 'ESTIMATE' : route.provider || 'OSRM',
        }
      : null,
    delegate,
  });
  return normalizePlan(body.data);
}

const planPath = (id, tail = '') => `/api/v1/incidents/${encodeURIComponent(id)}/dispatch-plan${tail}`;

/** @returns {Promise<object[]>} officers of the unit (camelCase), same shape as GET /officers/status */
export async function getDelegationCandidates(incidentId) {
  const body = await api.get(planPath(incidentId, '/candidates'));
  return (body.data || []).map((o) => ({
    accountId: o.account_id,
    fullName: o.full_name,
    email: o.email,
    phone: o.phone || '',
    unitLabel: o.unit_label,
    ward: o.ward,
    online: !!o.online,
    busy: !!o.busy,
    heldIncidentId: o.held_incident?.id || null,
    // 'Được uỷ quyền: ...' when busy because another case was delegated to them
    delegatedElsewhere: (o.held_incident?.status_label || '').startsWith('Được uỷ quyền'),
  }));
}

export async function delegateDispatch(incidentId, accountId) {
  const body = await api.post(planPath(incidentId, '/delegate'), { account_id: accountId });
  return normalizePlan(body.data);
}

export async function acceptDelegation(incidentId) {
  const body = await api.post(planPath(incidentId, '/accept'));
  return normalizePlan(body.data);
}

export async function rejectDelegation(incidentId, reason) {
  const body = await api.post(planPath(incidentId, '/reject'), { reason });
  return normalizePlan(body.data);
}

export async function departDelegation(incidentId) {
  const body = await api.post(planPath(incidentId, '/depart'));
  return normalizePlan(body.data);
}

export async function arriveDispatch(incidentId) {
  const body = await api.post(planPath(incidentId, '/arrive'));
  return normalizePlan(body.data);
}

/** Step 4: the unit on site (officer JWT) or the citizen (citizenToken) confirms the incident is handled. */
export async function confirmHandled(incidentId, { citizenToken } = {}) {
  const body = await api.post(planPath(incidentId, '/confirm'), null, {
    headers: citizenToken ? { [CITIZEN_TOKEN_HEADER]: citizenToken } : undefined,
  });
  return normalizePlan(body.data);
}

/** Closing report: { result: RESOLVED|FALSE_ALARM, summary, forces, note, force } */
export async function finishIncident(
  incidentId,
  { result, summary, forces, note, force = false, skipConfirm = false },
) {
  await api.post(planPath(incidentId, '/finish'), {
    result: force ? null : result,
    summary: summary?.trim() || null,
    forces: forces?.trim() || null,
    note: note?.trim() || null,
    force,
    skip_confirm: skipConfirm, // CHỈ ĐỂ TEST: "Kết thúc ngay (test)"
  });
}

/** The delegating officer takes back a delegation nobody answered (back to choosing in step 2). */
export async function withdrawDelegation(incidentId) {
  const body = await api.post(planPath(incidentId, '/withdraw'));
  return normalizePlan(body.data);
}
