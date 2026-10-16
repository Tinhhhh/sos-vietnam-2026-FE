/**
 * What the citizen's waiting screen needs about their own incident.
 *   { id, type, agency, level, status, province, ward, createdAt, escalateAt, escalatedAt,
 *     acceptedAt, cancelledAt, cancelReason, cancelReasonLabel, handler: { fullName, unitName } | null }
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
    acceptedAt: toDate(raw.accepted_at),
    cancelledAt: toDate(raw.cancelled_at),
    cancelReason: raw.cancel_reason || null,
    cancelReasonLabel: raw.cancel_reason_label || null,
    handler: raw.handler
      ? { fullName: raw.handler.full_name || 'Cán bộ', unitName: raw.handler.unit_name || null }
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
 * Police at ward level, not yet taken: count down to the hand-over to the province.
 * Everything else (CSGT, PCCC, province police, already taken): time waited since the report.
 */
export function timerMode(inc) {
  return inc.status === 'PENDING' && inc.escalateAt && !inc.escalatedAt ? 'countdown' : 'elapsed';
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
