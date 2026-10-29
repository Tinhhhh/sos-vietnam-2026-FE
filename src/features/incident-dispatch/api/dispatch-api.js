/**
 * Dispatch plan of an incident (be-v2, V5):
 *
 *   GET /api/v1/incidents/{id}/dispatch-plan   officer JWT, or the citizen with header X-SOS-Access-Token
 *       -> data: <plan> | null (no starting station chosen yet)
 *   GET  .../dispatch-plan/candidates          officers of the chosen ward station's unit (step 2)
 *   POST .../dispatch-plan/delegate { member_id }   "Lập tức liên hệ": hand it to that officer
 *   POST .../dispatch-plan/withdraw   delegating officer takes back an unanswered delegation
 *   POST .../dispatch-plan/accept | reject { reason } | depart { member_id }   the assigned (ward) officer
 *   GET  .../dispatch-plan/field-candidates   my unit's officers, to pick the field officer (GPS phone)
 *   PUT  .../dispatch-plan/field-member { member_id }   change the field officer while EN_ROUTE
 *   POST .../dispatch-plan/confirm   step 4 "Đã xử lý xong": the citizen token (or the unit on site) only
 *                                    records its confirmation, the case stays open
 *   POST .../dispatch-plan/finish { result, summary, forces, note, force }   closing report -> RESOLVED
 *                                    (needs the citizen's confirmation first, 409 otherwise; force skips it)
 *   POST .../dispatch-plan/arrive   "Đã đến": at the scene, step 4. One side is enough: the unit on site, the field
 *                                    officer, or the citizen (token)
 *   GET  /api/v1/geo/road-snap?lat&lng   where the vehicle should stop (big road outside an alley)
 *        -> { latitude, longitude, road_name, distance_m, source: MAIN_ROAD | NEAREST_ROAD | NONE }
 *   PUT /api/v1/incidents/{id}/dispatch-plan   officer holding the case (RESOLVING)
 *       body { station_id, destination { latitude, longitude, address, source }, route { distance_m,
 *              duration_s, polyline, provider }, delegate }
 *
 * <plan> = { dispatch_id, status, status_label, step (1..4), needs_delegation,
 *            station { id, name, agency_type, level, address, phone, latitude, longitude },
 *            destination { latitude, longitude, address, source: CITIZEN_GPS | OFFICER_EDIT | ROAD_SNAP },
 *            sos_point { latitude, longitude }   where the citizen is (differs from destination on ROAD_SNAP),
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

/*
 * last_position (only while EN_ROUTE): latest Traccar GPS point of the field officer, kept in the BE's RAM
 *   { latitude, longitude, speed_kmh, heading, accuracy_m, fix_time, received_at }
 */
function livePosition(p) {
  if (!p || p.latitude == null || p.longitude == null) return null;
  return {
    lat: p.latitude,
    lng: p.longitude,
    speedKmh: p.speed_kmh ?? null,
    heading: p.heading ?? null,
    receivedAt: toDate(p.received_at),
    source: p.source || null, // TRACCAR (app) | BROWSER (field link page)
  };
}

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
    sosPoint: point(raw.sos_point),
    route: raw.route
      ? {
          distanceM: raw.route.distance_m,
          durationS: raw.route.duration_s,
          durationTrafficS: raw.route.duration_traffic_s,
          coords: raw.route.polyline ? decodePolyline(raw.route.polyline) : null,
          provider: raw.route.provider,
          estimated: raw.route.provider === 'ESTIMATE',
          // recalculated from the vehicle's position after it left the route
          rerouted: raw.route.origin_source === 'VEHICLE',
          computedAt: toDate(raw.route.computed_at),
        }
      : null,
    assignedTo: raw.assigned_to
      ? {
          memberId: raw.assigned_to.member_id,
          fullName: raw.assigned_to.full_name,
          phone: raw.assigned_to.phone || '',
        }
      : null,
    // on the way: GPS distance to the destination; "Đã đến" allowed when within (30 m + accuracy, max 50 m)
    arrivalCheck: raw.arrival_check
      ? {
          distanceM: raw.arrival_check.distance_m,
          thresholdM: raw.arrival_check.threshold_m,
          within: !!raw.arrival_check.within,
        }
      : null,
    // how "Đã đến" was confirmed: GPS / HOLDER_OVERRIDE / FIELD_OVERRIDE (+ note) / CITIZEN
    arrivalSource: raw.arrival_source || null,
    arrivalSourceLabel: raw.arrival_source_label || null,
    arrivalNote: raw.arrival_note || null,
    // "Người nhận ca": the officer holding the case (phone only in the officers' copy)
    receiver: raw.receiver
      ? {
          memberId: raw.receiver.member_id,
          fullName: raw.receiver.full_name,
          phone: raw.receiver.phone || '',
        }
      : null,
    // field officer (delegated officer, else the dispatching one): name, badge (= Traccar device id), phone
    tracker: raw.tracker
      ? {
          memberId: raw.tracker.member_id,
          fullName: raw.tracker.full_name,
          phone: raw.tracker.phone || '',
          badgeNumber: raw.tracker.badge_number || '',
        }
      : null,
    lastPosition: livePosition(raw.last_position),
    // officers only (null for the citizen): demo "Mô phỏng di chuyển" button
    simulation: raw.simulation
      ? { available: !!raw.simulation.available, running: !!raw.simulation.running }
      : null,
    rejectReason: raw.reject_reason || null,
    officerConfirmedAt: toDate(raw.officer_confirmed_at),
    // officers only: when the field officer's link was last issued (null = none / voided)
    fieldLinkIssuedAt: toDate(raw.field_link_issued_at),
    citizenConfirmedAt: toDate(raw.citizen_confirmed_at),
    respondedAt: toDate(raw.responded_at),
    dispatchedAt: toDate(raw.dispatched_at),
    departedAt: toDate(raw.departed_at),
    arrivedAt: toDate(raw.arrived_at),
  };
}

/*
 * DEMO ONLY ("Ca demo" switch on, trip EN_ROUTE, field officer has a badge):
 *   POST /dispatch-plan/simulate       -> the BE sends a fake GPS point every 5 s along the route (via Traccar on
 *                                         the VPS), stopping 30 m before the scene; 403 / 409 otherwise
 *   POST /dispatch-plan/simulate/stop
 * Both return the plan (simulation.running).
 */
export async function startSimulation(incidentId) {
  const body = await api.post(`/api/v1/incidents/${encodeURIComponent(incidentId)}/dispatch-plan/simulate`);
  return normalizePlan(body.data);
}

/** DEMO: the simulated vehicle turns off the route, to test the automatic route recalculation. */
export async function detourSimulation(incidentId) {
  const body = await api.post(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/dispatch-plan/simulate/detour`,
  );
  return normalizePlan(body.data);
}

export async function stopSimulation(incidentId) {
  const body = await api.post(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/dispatch-plan/simulate/stop`,
  );
  return normalizePlan(body.data);
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
export async function saveDispatchPlan(
  incidentId,
  { stationId, destination, route, delegate, fieldMemberId },
) {
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
    // own unit goes: the field officer (carries the GPS phone); a delegated unit picks it when setting off
    field_member_id: delegate ? null : fieldMemberId || null,
  });
  return normalizePlan(body.data);
}

const planPath = (id, tail = '') => `/api/v1/incidents/${encodeURIComponent(id)}/dispatch-plan${tail}`;

/** @returns {Promise<object[]>} officers of the unit (camelCase), same shape as GET /officers/status */
export async function getDelegationCandidates(incidentId) {
  const body = await api.get(planPath(incidentId, '/candidates'));
  return (body.data || []).map((o) => ({
    memberId: o.member_id,
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

export async function delegateDispatch(incidentId, memberId) {
  const body = await api.post(planPath(incidentId, '/delegate'), { member_id: memberId });
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

/** The delegated unit sets off with its field officer (người phụ trách hiện trường). */
/**
 * "Khởi hành" (ACCEPTED -> EN_ROUTE): the field officer chosen before (PUT /field-member), or fieldMemberId to
 * choose and set off in one call.
 */
export async function departDelegation(incidentId, fieldMemberId = null) {
  const body = await api.post(
    planPath(incidentId, '/depart'),
    fieldMemberId ? { member_id: fieldMemberId } : {}, // JSON body: the BE reads an optional body
  );
  return normalizePlan(body.data);
}

/**
 * Officers of MY unit to pick the field officer from (holder of the case, or the delegated officer).
 * Online is only informative: they may be out working. selectable=false: no badge / on another trip.
 */
export async function getFieldCandidates(incidentId) {
  const body = await api.get(planPath(incidentId, '/field-candidates'));
  return (body.data || []).map((o) => ({
    memberId: o.member_id,
    fullName: o.full_name,
    badgeNumber: o.badge_number || '',
    position: o.position || '',
    commander: o.unit_role === 'COMMANDER',
    phone: o.phone || '',
    online: !!o.online,
    me: !!o.is_me,
    selectable: !!o.selectable,
    unavailableReason: o.unavailable_reason || '',
  }));
}

/**
 * Field officer's link /f/{token} (no login): POST .../dispatch-plan/field-link makes a new code (the old link stops
 * working). The code comes back only here, once.
 * @returns {Promise<{ token: string, path: string, issuedAt: Date|null, fieldMember: object|null }>}
 */
export async function issueFieldLink(incidentId) {
  const body = await api.post(planPath(incidentId, '/field-link'));
  const d = body.data || {};
  return {
    token: d.token,
    path: d.path,
    issuedAt: toDate(d.issued_at),
    fieldMember: d.field_member
      ? { fullName: d.field_member.full_name, badgeNumber: d.field_member.badge_number }
      : null,
    // link also sent by SMS to the field officer's phone (sent = the SMS gateway took it)
    sms: d.sms
      ? { sent: !!d.sms.sent, phoneMasked: d.sms.phone_masked || null, error: d.sms.error || null }
      : null,
  };
}

/** Change the field officer while the force is on the way (stops a running simulation). */
export async function changeFieldMember(incidentId, fieldMemberId) {
  const body = await api.put(planPath(incidentId, '/field-member'), { member_id: fieldMemberId });
  return normalizePlan(body.data);
}

/**
 * "Đã đến": officers / field officer only when the GPS is within the destination radius (BE checks); the officer
 * holding the case may confirm without GPS with a reason; the citizen (citizenToken) always.
 */
export async function arriveDispatch(incidentId, { citizenToken, reason } = {}) {
  const body = await api.post(planPath(incidentId, '/arrive'), reason ? { reason } : {}, {
    headers: citizenToken ? { [CITIZEN_TOKEN_HEADER]: citizenToken } : undefined,
  });
  return normalizePlan(body.data);
}

/** Where the vehicle should stop for this SOS point: nearest big road (null when nothing better was found). */
export async function getRoadSnap({ lat, lng }) {
  const body = await api.get('/api/v1/geo/road-snap', { params: { lat, lng } });
  const d = body?.data;
  if (!d || d.source === 'NONE' || d.latitude == null) return null;
  return {
    lat: d.latitude,
    lng: d.longitude,
    roadName: d.road_name || '',
    distanceM: d.distance_m ?? 0,
    big: d.source === 'MAIN_ROAD',
  };
}

/** Step 4: the unit on site (officer JWT) or the citizen (citizenToken) confirms the incident is handled. */
export async function confirmHandled(incidentId, { citizenToken } = {}) {
  const body = await api.post(planPath(incidentId, '/confirm'), null, {
    headers: citizenToken ? { [CITIZEN_TOKEN_HEADER]: citizenToken } : undefined,
  });
  return normalizePlan(body.data);
}

/** Closing report: { result: RESOLVED|FALSE_ALARM, summary, forces, note, force } */
export async function finishIncident(incidentId, { result, summary, forces, note, force = false }) {
  await api.post(planPath(incidentId, '/finish'), {
    result: force ? null : result,
    summary: summary?.trim() || null,
    forces: forces?.trim() || null,
    note: note?.trim() || null,
    force,
  });
}

/** The delegating officer takes back a delegation nobody answered (back to choosing in step 2). */
export async function withdrawDelegation(incidentId) {
  const body = await api.post(planPath(incidentId, '/withdraw'));
  return normalizePlan(body.data);
}
