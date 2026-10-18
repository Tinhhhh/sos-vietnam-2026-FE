import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  INCIDENT_CATEGORY_AGENCIES,
  INCIDENT_SUGGESTIONS,
  cleanIncidentLabel,
} from '@/config/incident-suggestions';

import { formatChange, formatDuration, formatNumber, formatRate, shortDay } from '../utils/format';
import { AGENCY_LOOK } from '../utils/slices';
import styles from './statistics.module.css';

const SLA_TARGET = 0.95;
const AXIS = { fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, ui-monospace, monospace' };
const GRID = '#22304d';
const TOOLTIP = {
  contentStyle: { background: '#0e1424', border: '1px solid #22304d', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#e8eef8' },
  cursor: { fill: 'rgba(56, 189, 248, 0.08)' },
};

/** A card with an uppercase title; `actions` (e.g. a mode switch) sits at the right of the title. */
export function Panel({ title, hint, actions, wide, children }) {
  return (
    <section className={`${styles.panel} ${wide ? styles.wide : ''}`}>
      <h2 className={styles.panelTitle}>
        {title} {actions || (hint && <small>{hint}</small>)}
      </h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, alert }) {
  return (
    <div className={`${styles.kpi} ${alert ? styles.kpiAlert : ''}`}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  );
}

/** Top KPI row. Numbers that need the "close case" module show as pending, never as 0. */
export function KpiRow({ kpis, showEscalation }) {
  const change = formatChange(kpis.total, kpis.previousTotal);
  const slaOk = kpis.withinSlaRate != null && kpis.withinSlaRate >= SLA_TARGET;
  return (
    <div className={styles.kpis}>
      <Kpi
        label="Tổng sự cố"
        value={formatNumber(kpis.total)}
        sub={
          kpis.previousTotal == null ? (
            'Kỳ trước: —'
          ) : (
            <>
              Kỳ trước {formatNumber(kpis.previousTotal)}
              {change && (
                <>
                  {' · '}
                  <b className={change.startsWith('+') ? styles.up : styles.down}>{change}</b>
                </>
              )}
            </>
          )
        }
      />
      <Kpi
        label="Đang chờ nhận"
        value={formatNumber(kpis.pending)}
        sub="Chưa cán bộ nào nhận"
        alert={kpis.pending > 0}
      />
      <Kpi
        label="Thời gian nhận TB"
        value={formatDuration(kpis.avgAcceptSeconds)}
        sub={`Trung vị ${formatDuration(kpis.medianAcceptSeconds)} · ${formatNumber(kpis.accepted)} ca đã nhận`}
      />
      <Kpi
        label={`Nhận trong ${kpis.slaMinutes}'`}
        value={formatRate(kpis.withinSlaRate)}
        sub={
          <>
            Mục tiêu ≥ 95%
            {kpis.withinSlaRate != null && (
              <b className={slaOk ? styles.down : styles.up}> · {slaOk ? 'Đạt' : 'Chưa đạt'}</b>
            )}
          </>
        }
        alert={kpis.withinSlaRate != null && !slaOk}
      />
      {showEscalation && (
        <Kpi
          label="Leo thang lên tỉnh"
          value={formatNumber(kpis.escalated)}
          sub={kpis.total ? `${formatRate(kpis.escalated / kpis.total)} tổng số ca` : "Quá 15' chưa ai nhận"}
        />
      )}
      <Kpi
        label="Báo khống"
        value={
          kpis.fakeAlarmCount == null ? (
            <span className={styles.pendingModule}>Chờ module đóng ca</span>
          ) : (
            formatNumber(kpis.fakeAlarmCount)
          )
        }
        sub={
          kpis.fakeAlarmCount != null && kpis.total
            ? `${formatRate(kpis.fakeAlarmCount / kpis.total)} tổng số ca`
            : null
        }
      />
    </div>
  );
}

export function HourChart({ byHour }) {
  const data = byHour.map((count, hour) => ({ hour: `${hour}h`, count }));
  if (!byHour.some(Boolean)) return <div className={styles.empty}>Chưa có sự cố trong khoảng này.</div>;
  return (
    <div className={styles.chartBox}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="hour" tick={AXIS} interval={2} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} formatter={(v) => [v, 'Sự cố']} />
          <Bar dataKey="count" fill="#38bdf8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DayChart({ byDay }) {
  if (!byDay.length) return <div className={styles.empty}>Chưa có dữ liệu theo ngày.</div>;
  const data = byDay.map((d) => ({ ...d, day: shortDay(d.date) }));
  return (
    <>
      <div className={styles.chartBox}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={12} />
            <YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="total" name="Tổng" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            <Line
              dataKey="escalated"
              name="Leo thang"
              stroke="#ff4d6a"
              strokeWidth={2}
              dot={false}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.legend}>
        <span>
          <i className={styles.swatch} style={{ background: '#38bdf8' }} />
          Tổng sự cố
        </span>
        <span>
          <i className={styles.swatch} style={{ background: '#ff4d6a' }} />
          Leo thang
        </span>
      </div>
    </>
  );
}

/**
 * Incidents per category: exactly the suggestion groups the SOS form offers for the force(s) in
 * scope (without their icons), zero rows included; no suggestion picked or a tag outside the list = "Khác".
 * @param {{ byTag: { tag: string | null, count: number }[], agency?: string | null }} props
 *   agency: 'police' | 'csgt' | 'fire'; empty = every force (admin, all forces)
 */
export function TagList({ byTag, agency }) {
  const agencies = agency ? [agency] : INCIDENT_CATEGORY_AGENCIES;
  const counts = new Map();
  byTag.forEach((t) => {
    const key = t.tag ? cleanIncidentLabel(t.tag) : '';
    counts.set(key, (counts.get(key) || 0) + t.count);
  });

  const used = new Set();
  const groups = agencies.map((a) => ({
    agency: a,
    rows: (INCIDENT_SUGGESTIONS[a] || []).map((label) => {
      const name = cleanIncidentLabel(label);
      used.add(name);
      return { name, count: counts.get(name) || 0 };
    }),
  }));
  let other = 0;
  counts.forEach((count, name) => {
    if (!used.has(name)) other += count;
  });

  const max = Math.max(1, other, ...groups.flatMap((g) => g.rows.map((r) => r.count)));
  const row = (key, name, count) => (
    <tr key={key}>
      <td style={{ whiteSpace: 'normal' }}>{name}</td>
      <td style={{ width: '45%' }}>
        <div className={styles.barCell}>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(count / max) * 100}%` }} />
          </div>
        </div>
      </td>
      <td className={styles.num}>{formatNumber(count)}</td>
    </tr>
  );

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <tbody>
          {groups.map((g) => [
            groups.length > 1 && (
              <tr key={`h-${g.agency}`}>
                <td
                  colSpan={3}
                  style={{
                    paddingTop: 10,
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                  }}
                >
                  {AGENCY_LOOK[g.agency]?.label || g.agency}
                </td>
              </tr>
            ),
            ...g.rows.map((r) => row(`${g.agency}-${r.name}`, r.name, r.count)),
          ])}
          {groups.length > 1 && (
            <tr>
              <td colSpan={3} style={{ paddingTop: 10 }} />
            </tr>
          )}
          {row('other', 'Khác', other)}
        </tbody>
      </table>
    </div>
  );
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const heatColor = (ratio) =>
  ratio === 0 ? '#141c31' : `color-mix(in oklab, #38bdf8 ${Math.round(15 + ratio * 85)}%, #141c31)`;

export function Heatmap({ heatmap }) {
  const max = Math.max(1, ...heatmap.flat());
  if (!heatmap.flat().some(Boolean))
    return <div className={styles.empty}>Chưa có sự cố trong khoảng này.</div>;
  return (
    <>
      <div className={styles.tableWrap}>
        <div className={styles.heat}>
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className={styles.heatLabel}>
              {h % 6 === 0 ? h : ''}
            </span>
          ))}
          {heatmap.map((row, r) => (
            <HeatRow key={WEEKDAYS[r]} label={WEEKDAYS[r]} row={row} max={max} />
          ))}
        </div>
      </div>
      <div className={styles.legend}>
        <span>Ít</span>
        {[0.1, 0.35, 0.6, 0.85, 1].map((v) => (
          <i key={v} className={styles.swatch} style={{ background: heatColor(v), marginRight: 0 }} />
        ))}
        <span>Nhiều</span>
      </div>
    </>
  );
}

function HeatRow({ label, row, max }) {
  return (
    <>
      <span className={styles.heatLabel} style={{ justifyContent: 'flex-start' }}>
        {label}
      </span>
      {row.map((v, h) => (
        <span
          key={h}
          className={styles.heatCell}
          style={{ background: heatColor(v / max) }}
          title={`${label} ${h}h: ${v} sự cố`}
        />
      ))}
    </>
  );
}

/** Wards (province view) or provinces (national view), worst escalation first. */
export function AreaTable({ byArea, areaLabel }) {
  if (!byArea.length) return <div className={styles.empty}>Chưa có sự cố trong khoảng này.</div>;
  const rows = [...byArea].sort((a, b) => b.escalated - a.escalated || b.total - a.total);
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{areaLabel}</th>
            <th className={styles.num}>Tổng</th>
            <th className={styles.num}>Đang chờ</th>
            <th className={styles.num}>TG nhận TB</th>
            <th className={styles.num}>Nhận trong 15'</th>
            <th className={styles.num}>Leo thang</th>
            <th>Tỷ trọng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className={styles.num}>{formatNumber(r.total)}</td>
              <td className={styles.num}>
                {r.pending ? <span className={`${styles.chip} ${styles.chipWarn}`}>{r.pending}</span> : 0}
              </td>
              <td className={styles.num}>{formatDuration(r.avgAcceptSeconds)}</td>
              <td className={styles.num}>
                {r.withinSlaRate == null ? (
                  '—'
                ) : (
                  <span
                    className={`${styles.chip} ${r.withinSlaRate >= SLA_TARGET ? styles.chipOk : styles.chipBad}`}
                  >
                    {formatRate(r.withinSlaRate)}
                  </span>
                )}
              </td>
              <td className={styles.num}>{formatNumber(r.escalated)}</td>
              <td>
                <div className={styles.barCell}>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(r.total / max) * 100}%` }} />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AgencyChart({ byAgency }) {
  if (!byAgency.some((a) => a.total))
    return <div className={styles.empty}>Chưa có sự cố trong khoảng này.</div>;
  const data = byAgency.map((a) => ({ ...a, label: AGENCY_LOOK[a.agency]?.label || a.agency }));
  return (
    <div className={styles.chartBox}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 16, left: 10, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ ...AXIS, fontSize: 11 }}
            width={90}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip {...TOOLTIP} formatter={(v) => [v, 'Sự cố']} />
          <Bar dataKey="total" radius={[0, 3, 3, 0]}>
            {data.map((a) => (
              <Cell key={a.agency} fill={AGENCY_LOOK[a.agency]?.color || '#38bdf8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ward view: pending incidents counting down to escalation, soonest first. */
export function EscalatingList({ items }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!items.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [items.length]);

  if (!items.length) return <div className={styles.empty}>Không có ca nào sắp leo thang.</div>;
  return (
    <div className={styles.escList}>
      {items.map((i) => {
        const left = Math.max(0, Math.floor((i.escalateAt.getTime() - now) / 1000));
        const color = left < 300 ? '#ff4d6a' : left < 600 ? '#fbbf24' : '#e8eef8';
        return (
          <div key={i.id} className={styles.escItem}>
            <span className={styles.escId}>{i.id}</span>
            <span className={styles.escText}>
              {i.tags.join(', ') || 'Chưa chọn loại'} · {i.address || 'Chưa xác định vị trí'}
            </span>
            <span className={styles.escTimer} style={{ color }}>
              {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Daily share of incidents accepted within the SLA, with the 95% target as a dashed line. */
export function SlaTrendChart({ byDay }) {
  if (!byDay.some((d) => d.withinSlaRate != null)) {
    return <div className={styles.empty}>Chưa có ca nào được nhận trong khoảng này.</div>;
  }
  const data = byDay.map((d) => ({
    day: shortDay(d.date),
    rate: d.withinSlaRate == null ? null : Math.round(d.withinSlaRate * 1000) / 10,
    accepted: d.accepted,
  }));
  return (
    <>
      <div className={styles.chartBox}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={12} />
            <YAxis
              tick={AXIS}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 95, 100]}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              {...TOOLTIP}
              formatter={(v, _name, item) => [
                `${v}% (${item.payload.accepted} ca đã nhận)`,
                "Nhận trong 15'",
              ]}
            />
            <ReferenceLine y={SLA_TARGET * 100} stroke="#fbbf24" strokeDasharray="5 4" />
            <Line
              dataKey="rate"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#34d399' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.legend}>
        <span>
          <i className={styles.swatch} style={{ background: '#34d399' }} />
          Tỷ lệ nhận trong 15'
        </span>
        <span>
          <i className={styles.swatch} style={{ background: '#fbbf24' }} />
          Mục tiêu 95%
        </span>
        <span>Ngày chưa có ca được nhận để trống</span>
      </div>
    </>
  );
}

const SLICE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#22d3ee', '#f472b6'];
const OTHER_COLOR = '#64748b';
const MAX_SLICES = 8;

/** Biggest slices first; everything after the 8th is merged into "Khác". */
function toSlices(items) {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, MAX_SLICES).map((i, idx) => ({ ...i, color: i.color || SLICE_COLORS[idx] }));
  const rest = sorted.slice(MAX_SLICES);
  if (rest.length) {
    top.push({
      key: '__other',
      name: `Khác (${rest.length})`,
      value: rest.reduce((sum, i) => sum + i.value, 0),
      color: OTHER_COLOR,
    });
  }
  return top;
}

/** Hovered slice: pushed out a little, thick light border. */
function ActiveSlice(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 7}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="#f8fafc"
      strokeWidth={3}
    />
  );
}

/**
 * Share pie (donut). `modes` = [{ key, label, items: [{ key, name, value, color? }] }]; the mode
 * switch lives in the panel title. Hovering a slice or a legend row highlights it and shows its name.
 */
export function SharePanel({ title, modes }) {
  const [modeKey, setModeKey] = useState(modes[0].key);
  const [active, setActive] = useState(null);
  const mode = modes.find((m) => m.key === modeKey) || modes[0];
  const slices = toSlices(mode.items);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const hovered = active == null ? null : slices[active];

  const switcher = (
    <span className={styles.segmented} role="group" aria-label="Chọn cách chia">
      {modes.map((m) => (
        <button
          key={m.key}
          type="button"
          className={styles.segBtn}
          aria-pressed={m.key === mode.key}
          onClick={() => {
            setModeKey(m.key);
            setActive(null);
          }}
        >
          {m.label}
        </button>
      ))}
    </span>
  );

  return (
    <Panel title={title} actions={switcher}>
      {!total ? (
        <div className={styles.empty}>Chưa có sự cố trong khoảng này.</div>
      ) : (
        <div className={styles.pieWrap}>
          <div className={styles.pieBox}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="52%"
                  outerRadius="82%"
                  paddingAngle={slices.length > 1 ? 1.5 : 0}
                  stroke="#0e1424"
                  strokeWidth={slices.length > 1 ? 2 : 0}
                  activeIndex={active ?? undefined}
                  activeShape={ActiveSlice}
                  onMouseEnter={(_, idx) => setActive(idx)}
                  onMouseLeave={() => setActive(null)}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.pieCenter}>
              {hovered ? (
                <>
                  <b>{hovered.name}</b>
                  <span>
                    {formatNumber(hovered.value)} ca · {formatRate(hovered.value / total)}
                  </span>
                </>
              ) : (
                <>
                  <b>{formatNumber(total)}</b>
                  <span>ca sự cố</span>
                </>
              )}
            </div>
          </div>
          <ul className={styles.pieLegend}>
            {slices.map((s, idx) => (
              <li
                key={s.key}
                className={idx === active ? styles.pieLegendActive : ''}
                onMouseEnter={() => setActive(idx)}
                onMouseLeave={() => setActive(null)}
              >
                <i className={styles.swatch} style={{ background: s.color }} />
                <span className={styles.pieLegendName} title={s.name}>
                  {s.name}
                </span>
                <span className={styles.num}>{formatRate(s.value / total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
