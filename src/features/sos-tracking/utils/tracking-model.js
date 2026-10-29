/**
 * What the citizen's waiting screen needs about their own incident.
 *   { id, type, agency, level, status, province, ward, createdAt, escalateAt, escalatedAt,
 *     acceptedAt, cancelledAt, cancelReason, cancelReasonLabel, handler: { fullName, unitName } | null,
 *     lookupCode: 'K7M2-QX9P' | null (only once RESOLVED) }
 * cancelReason: MISTAKE | RESOLVED_SELF | CALLED_HOTLINE | OTHER (citizen) | NO_RESPONDER (auto, waited too long)
 * agency / level keep the be-v2 enum names (POLICE | CSGT | FIRE | HOSPITAL, WARD | PROVINCE | NATIONAL).
 */
const AGENCY_OF_TYPE = { POLICE: 'POLICE', TRAFFIC: 'CSGT', FIRE: 'FIRE', AMBULANCE: 'HOSPITAL' };

const AGENCY_UNIT = { POLICE: 'Công an', CSGT: 'CSGT', FIRE: 'Cảnh sát PCCC & CNCH', HOSPITAL: 'Y tế' };

export const TYPE_TEXT = {
  POLICE: { label: 'An ninh trật tự', icon: '👮' },
  TRAFFIC: { label: 'Tai nạn giao thông', icon: '🚗' },
  FIRE: { label: 'Cháy nổ / Cứu nạn', icon: '🚒' },
  AMBULANCE: { label: 'Cấp cứu y tế', icon: '🚑' },
};

export const CLOSED_STATUSES = ['RESOLVED', 'CANCELLED'];

const toDate = (v) => (v ? new Date(v) : null);

/** Accepts GET /incidents/{id}/tracking data and the incident returned by POST /incidents. */
export function normalizeTracking(raw) {
  if (!raw?.id) return null;
  const type = raw.emergency_type || 'POLICE';
  return {
    id: raw.id,
    type,
    agency: raw.routed_agency || AGENCY_OF_TYPE[type] || 'POLICE',
    level: raw.routed_level || null,
    status: raw.status || 'PENDING',
    province: raw.province || '',
    ward: raw.ward || '',
    createdAt: toDate(raw.created_at) || new Date(),
    escalateAt: toDate(raw.escalate_at),
    escalatedAt: toDate(raw.escalated_at),
    // OFFICER_REQUEST (the ward officer moved it) | NO_RESPONSE_TIMEOUT | CITIZEN_REQUEST | null
    escalationReason: raw.escalation_reason || null,
    acceptedAt: toDate(raw.accepted_at),
    // the officer wrote the closing report ("Đã xử lý xong"): the case closes once the citizen confirms too
    officerConfirmedAt: toDate(raw.officer_confirmed_at),
    citizenConfirmedAt: toDate(raw.citizen_confirmed_at),
    cancelledAt: toDate(raw.cancelled_at),
    cancelReason: raw.cancel_reason || null,
    cancelReasonLabel: raw.cancel_reason_label || null,
    lookupCode: raw.lookup_code || null,
    // report document: NONE | AWAITING_CITIZEN | CITIZEN_SIGNED | SIGNED
    documentStatus: raw.document_status || 'NONE',
    resolvedAt: toDate(raw.resolved_at),
    handler: raw.handler
      ? { fullName: raw.handler.full_name || 'Lực lượng chức năng', unitName: raw.handler.unit_name || null }
      : null,
  };
}

/** "Công an Phường Tân An", "CSGT Cần Thơ"... the unit currently receiving the incident. */
export function receivingUnit(inc) {
  const unit = AGENCY_UNIT[inc.agency] || 'Lực lượng chức năng';
  if (inc.level === 'NATIONAL') return `${unit} - Trung tâm điều hành quốc gia`;
  const area =
    inc.level === 'WARD' ? inc.ward : inc.level === 'PROVINCE' ? inc.province : inc.ward || inc.province;
  return area ? `${unit} ${area}` : unit;
}

/**
 * What the box next to "Huỷ báo cáo" shows (ward-level police incidents have a 15-minute deadline):
 * - countdown   PENDING / VERIFYING before the deadline: the "Yêu cầu chuyển lên cấp tỉnh" button is
 *               already there, greyed out, with the time left until it can be pressed
 * - request     PENDING / VERIFYING past the deadline and forces not dispatched yet: the button is active
 *               (nobody took it / the officer took it and went silent)
 * - locked      RESOLVING: forces are on the way, the request button is greyed out
 * - province    everything else (already escalated, province level, CSGT, PCCC): the button stays greyed out
 *               with the reason, no "time waited" clock
 */
export function timerMode(inc, now) {
  const wardDeadline = inc.level === 'WARD' && inc.escalateAt && !inc.escalatedAt;
  if (!wardDeadline) return 'province';
  if (inc.status === 'RESOLVING') return 'locked';
  const overdue = inc.escalateAt.getTime() <= now;
  if (inc.status === 'VERIFYING' || inc.status === 'PENDING') return overdue ? 'request' : 'countdown';
  return 'province';
}

/** mm:ss, or h:mm:ss after an hour. */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}
