/** Date helpers and number formats for the statistics page (dates are VN local days). */

const pad = (n) => String(n).padStart(2, '0');

/** Date -> "YYYY-MM-DD" in the browser's local time. */
export function toIsoDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const RANGE_PRESETS = [
  { key: 'today', label: 'Hôm nay', days: 1 },
  { key: '7d', label: '7 ngày', days: 7 },
  { key: '30d', label: '30 ngày', days: 30 },
];

/** { from, to } for a preset: the last N days including today. */
export function presetRange(days, now = new Date()) {
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return { from: toIsoDay(from), to: toIsoDay(now) };
}

/** 192 -> 3'12" ; null -> "—". */
export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h${pad(m % 60)}'`;
  return `${m}'${pad(s % 60)}"`;
}

/** 0.923 -> "92%" ; null -> "—". */
export function formatRate(rate) {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

export function formatNumber(n) {
  return n == null ? '—' : n.toLocaleString('vi-VN');
}

/** Change vs the previous period: "+27%", "−5%", or null when it cannot be computed. */
export function formatChange(current, previous) {
  if (previous == null || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${Math.abs(pct)}%`;
}

/** "2026-10-15" -> "15/10". */
export function shortDay(iso) {
  const [, m, d] = String(iso).split('-');
  return d && m ? `${Number(d)}/${Number(m)}` : iso;
}
