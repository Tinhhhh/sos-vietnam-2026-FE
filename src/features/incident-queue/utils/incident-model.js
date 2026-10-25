import { cleanIncidentLabel } from '@/config/incident-suggestions';

/**
 * One incident shape for the officer console.
 *   { id, type, agency, level, status, province, ward, address, lat, lng, tags, description,
 *     citizenName, phone, mediaCount, imageCount, videoCount, createdAt, escalateAt, escalatedAt,
 *     handler: { memberId, fullName } | null, heldByMe, canHandle }
 * Dates are Date objects (null when missing). agency uses the console keys
 * (police | csgt | fire | hospital), level is 'ward' | 'province' | 'national'.
 */
const AGENCY_BY_TYPE = {
  POLICE: 'police',
  CSGT: 'csgt',
  FIRE: 'fire',
  HOSPITAL: 'hospital',
};

// Citizen-side category (EmergencyType) -> what the card shows.
export const TYPE_LOOK = {
  POLICE: { label: 'An ninh trật tự', icon: '👮‍♂️' },
  TRAFFIC: { label: 'Tai nạn giao thông', icon: '🚗' },
  FIRE: { label: 'Cháy nổ / Cứu nạn', icon: '🚒' },
  AMBULANCE: { label: 'Cấp cứu y tế', icon: '🚑' },
};

export const AGENCY_LABEL = {
  police: 'Công An',
  csgt: 'Cảnh Sát Giao Thông',
  fire: 'PCCC & CNCH',
  hospital: 'Y Tế 115',
};

const toDate = (v) => (v ? new Date(v) : null);

/** Tags without the chip emoji ("🔥 Cháy nhà dân" -> "Cháy nhà dân"). */
export const cleanTags = (tags) => (Array.isArray(tags) ? tags.map(cleanIncidentLabel).filter(Boolean) : []);

export function normalizeIncident(raw) {
  if (!raw?.id) return null;
  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);
  return {
    id: raw.id,
    type: raw.emergency_type || 'POLICE',
    agency: AGENCY_BY_TYPE[raw.routed_agency] || 'police',
    level: raw.routed_level ? String(raw.routed_level).toLowerCase() : 'ward',
    status: raw.status || 'PENDING',
    province: raw.province || '',
    ward: raw.ward || '',
    address: raw.address || '',
    lat: raw.latitude != null && Number.isFinite(lat) ? lat : null,
    lng: raw.longitude != null && Number.isFinite(lng) ? lng : null,
    tags: cleanTags(raw.incident_tags),
    description: raw.description || '',
    citizenName: raw.citizen_name || '',
    phone: raw.phone || '',
    mediaCount: raw.media_count || 0,
    imageCount: raw.image_count || 0,
    videoCount: raw.video_count || 0,
    createdAt: toDate(raw.created_at),
    escalateAt: toDate(raw.escalate_at),
    escalatedAt: toDate(raw.escalated_at),
    escalationReasonLabel: raw.escalation_reason_label || null,
    transferredFromLabel: raw.transferred_from_label || null,
    transferReason: raw.transfer_reason || null,
    escalationNote: raw.escalation_note || null,
    handler: raw.handler
      ? { memberId: raw.handler.member_id, fullName: raw.handler.full_name || 'Cán bộ' }
      : null,
    heldByMe: raw.held_by_me === true,
    canHandle: raw.can_handle === true,
    // field officer picked at "Yêu cầu điều động" (step 1 reuses it when my own unit goes)
    fieldMemberId: raw.field_member_id ?? null,
    dispatchStep: raw.dispatch_step ?? null, // 1-4 of the dispatch, null = no starting station yet
    // Step 2 of a dispatch: the case was handed to a ward unit (null otherwise)
    delegation: raw.delegation
      ? {
          dispatchId: raw.delegation.dispatch_id,
          status: raw.delegation.status,
          statusLabel: raw.delegation.status_label,
          step: raw.delegation.step,
          stationName: raw.delegation.station_name,
          fromUnit: raw.delegation.from_unit,
          fromOfficer: raw.delegation.from_officer,
          assignedTo: raw.delegation.assigned_to
            ? {
                memberId: raw.delegation.assigned_to.member_id,
                fullName: raw.delegation.assigned_to.full_name,
              }
            : null,
          assignedToMe: raw.delegation.assigned_to_me === true,
          delegatedToMyUnit: raw.delegation.delegated_to_my_unit === true,
          rejectReason: raw.delegation.reject_reason || null,
        }
      : null,
  };
}

/** Seconds left before a ward-level incident escalates to the province; null when it no longer can. */
export function secondsToEscalation(incident, now) {
  if (!incident.escalateAt || incident.escalatedAt || incident.status !== 'PENDING') return null;
  return Math.max(0, Math.floor((incident.escalateAt.getTime() - now) / 1000));
}

export function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Closed incident in the history window (GET /incidents/history):
 *   { id, type, agency, level, status, statusLabel, province, ward, address, tags, citizenName, phone,
 *     createdAt, acceptedAt, closedAt, cancelReason, cancelReasonLabel, handlerName, dispatchCount }
 */
export function normalizeHistoryItem(raw) {
  if (!raw?.id) return null;
  return {
    id: raw.id,
    type: raw.emergency_type || 'POLICE',
    agency: AGENCY_BY_TYPE[raw.routed_agency] || 'police',
    level: raw.routed_level ? String(raw.routed_level).toLowerCase() : null,
    status: raw.status,
    statusLabel: raw.status_label || raw.status,
    province: raw.province || '',
    ward: raw.ward || '',
    address: raw.address || '',
    tags: cleanTags(raw.incident_tags),
    citizenName: raw.citizen_name || '',
    phone: raw.phone || '',
    createdAt: toDate(raw.created_at),
    acceptedAt: toDate(raw.accepted_at),
    closedAt: toDate(raw.closed_at),
    cancelReason: raw.cancel_reason || null,
    cancelReasonLabel: raw.cancel_reason_label || null,
    handlerName: raw.handler_name || null,
    dispatchCount: raw.dispatch_count || 0,
    // văn bản báo cáo: NONE | DRAFT | SIGNED
    documentStatus: raw.document_status || 'NONE',
  };
}
