import { api } from '@/lib/api-client';

/*
 * Statistics dashboard (approved proposal: https://claude.ai/artifact/EMYSFrjDB7CD9nerUCYi3t).
 * be-v2 picks the scope (agency, level, province, ward) from the JWT; ADMIN may narrow it.
 *
 *   GET /api/v1/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD   (ADMIN: &province=&agency=)
 *     -> data: {
 *          scope: { agency, level, province, ward },
 *          range: { from, to, previous_from, previous_to },
 *          kpis: { total, previous_total, pending, accepted, escalated,
 *                  avg_accept_seconds, median_accept_seconds,     // null when nothing accepted
 *                  within_sla_rate, sla_minutes,                  // 0..1, null when nothing accepted
 *                  fake_alarm_count, resolved_count },            // null until cases can be closed
 *          by_tag:    [{ tag, count }],
 *          by_hour:   [24 numbers],                              // VN time
 *          by_day:    [{ date, total, escalated, accepted, within_sla_rate }], // rate null = nothing accepted that day
 *          heatmap:   [7 rows Mon..Sun x 24 numbers],
 *          by_area:   [{ name, total, pending, escalated, avg_accept_seconds, within_sla_rate }],
 *                     // wards for a province scope, provinces for the national scope, [] for a ward
 *          by_agency: [{ agency, total }],   // province + national: EVERY force in the area (pie chart)
 *        }
 *
 * The ward "about to escalate" list reuses GET /api/v1/incidents/queue (no extra endpoint).
 */
const AGENCY_KEY = { POLICE: 'police', CSGT: 'csgt', FIRE: 'fire', HOSPITAL: 'hospital' };

const num = (v) => (v == null ? null : Number(v));

export async function getDashboardSummary({ from, to, province, agency }) {
  const params = { from, to };
  if (province) params.province = province;
  if (agency) params.agency = agency;
  const body = await api.get('/api/v1/dashboard/summary', { params });
  const d = body?.data || {};
  const k = d.kpis || {};
  return {
    scope: {
      agency: AGENCY_KEY[d.scope?.agency] || null,
      level: d.scope?.level ? String(d.scope.level).toLowerCase() : null,
      province: d.scope?.province || null,
      ward: d.scope?.ward || null,
    },
    kpis: {
      total: num(k.total) ?? 0,
      previousTotal: num(k.previous_total),
      pending: num(k.pending) ?? 0,
      accepted: num(k.accepted) ?? 0,
      escalated: num(k.escalated) ?? 0,
      avgAcceptSeconds: num(k.avg_accept_seconds),
      medianAcceptSeconds: num(k.median_accept_seconds),
      withinSlaRate: num(k.within_sla_rate),
      slaMinutes: num(k.sla_minutes) ?? 15,
      fakeAlarmCount: num(k.fake_alarm_count),
      resolvedCount: num(k.resolved_count),
    },
    // tag null = the citizen picked no suggestion (counted as "Khác" on the page)
    byTag: (d.by_tag || []).map((t) => ({ tag: t.tag || null, count: Number(t.count) || 0 })),
    byHour: Array.from({ length: 24 }, (_, h) => Number(d.by_hour?.[h]) || 0),
    byDay: (d.by_day || []).map((x) => ({
      date: x.date,
      total: Number(x.total) || 0,
      escalated: Number(x.escalated) || 0,
      accepted: Number(x.accepted) || 0,
      withinSlaRate: num(x.within_sla_rate),
    })),
    heatmap: Array.from({ length: 7 }, (_, r) =>
      Array.from({ length: 24 }, (_, h) => Number(d.heatmap?.[r]?.[h]) || 0),
    ),
    byArea: (d.by_area || []).map((a) => ({
      name: a.name || 'Chưa xác định',
      total: Number(a.total) || 0,
      pending: Number(a.pending) || 0,
      escalated: Number(a.escalated) || 0,
      avgAcceptSeconds: num(a.avg_accept_seconds),
      withinSlaRate: num(a.within_sla_rate),
    })),
    byAgency: (d.by_agency || []).map((a) => ({
      agency: AGENCY_KEY[a.agency] || 'police',
      total: Number(a.total) || 0,
    })),
  };
}

/** Pending incidents of the unit that still count down to escalation (ward view). */
export async function getEscalatingIncidents() {
  // First 100 of the queue (newest first) is plenty for a "next to escalate" list
  const body = await api.get('/api/v1/incidents/queue', { params: { pageNo: 0, pageSize: 100 } });
  return (body?.data?.content || [])
    .filter((i) => i.status === 'PENDING' && i.escalate_at && !i.escalated_at)
    .map((i) => ({
      id: i.id,
      tags: i.incident_tags || [],
      address: i.address || [i.ward, i.province].filter(Boolean).join(', '),
      escalateAt: new Date(i.escalate_at),
    }))
    .sort((a, b) => a.escalateAt - b.escalateAt);
}

export async function getProvinceNames() {
  const body = await api.get('/api/v1/geo/provinces');
  return (body?.data || []).map((p) => p.name).filter(Boolean);
}
