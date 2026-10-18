import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { getProvinceNames } from '../api/dashboard';
import { useDashboard } from '../hooks/use-dashboard';
import { RANGE_PRESETS, presetRange, toIsoDay } from '../utils/format';
import { agencySlices, areaSlices } from '../utils/slices';
import {
  AgencyChart,
  AreaTable,
  DayChart,
  EscalatingList,
  Heatmap,
  HourChart,
  KpiRow,
  Panel,
  SharePanel,
  SlaTrendChart,
  TagList,
} from './panels';
import styles from './statistics.module.css';

const LEVEL_LABEL = { ward: 'Cấp xã/phường', province: 'Cấp tỉnh/thành phố', national: 'Toàn quốc' };
const AGENCY_OPTIONS = [
  { value: '', label: 'Mọi lực lượng' },
  { value: 'POLICE', label: 'Công an' },
  { value: 'CSGT', label: 'CSGT' },
  { value: 'FIRE', label: 'PCCC & CNCH' },
];

/**
 * Full-screen statistics dashboard (tab "Thống Kê"). What it shows depends on the scope be-v2
 * derives from the account: a ward sees "what needs action now", a province compares its wards,
 * the command centre (ADMIN) compares provinces and may filter by province / force.
 *
 * @param {{ officer: object, backHref: string }} props  officer = buildOfficerProfile(...)
 */
export function StatisticsPage({ officer, backHref }) {
  const [preset, setPreset] = useState('7d');
  const [custom, setCustom] = useState(() => presetRange(7));
  const [province, setProvince] = useState('');
  const [agency, setAgency] = useState('');
  const [provinces, setProvinces] = useState([]);

  const range = preset === 'custom' ? custom : presetRange(RANGE_PRESETS.find((p) => p.key === preset).days);
  const level = officer.level;
  const dashboard = useDashboard({
    from: range.from,
    to: range.to,
    province: officer.isAdmin ? province : undefined,
    agency: officer.isAdmin ? agency : undefined,
    withEscalating: level === 'ward',
  });

  useEffect(() => {
    if (!officer.isAdmin) return;
    getProvinceNames()
      .then(setProvinces)
      .catch(() => setProvinces([]));
  }, [officer.isAdmin]);

  const data = dashboard.data;
  // ADMIN filtered to one province looks at it like a province officer would
  const viewLevel = data?.scope.level || (officer.isAdmin ? (province ? 'province' : 'national') : level);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.titleBlock}>
          <Link to={backHref} className={styles.back}>
            ← Bàn chỉ huy
          </Link>
          <div>
            <h1 className={styles.title}>Thống kê sự cố</h1>
            <div className={styles.subtitle}>
              {officer.isAdmin ? 'Trung tâm chỉ huy' : officer.unitName} · {LEVEL_LABEL[viewLevel] || ''}
              {data?.scope.province && viewLevel !== 'national' ? ` · ${data.scope.province}` : ''}
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          {officer.isAdmin && (
            <>
              <select
                id="stats-province"
                className={styles.select}
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                aria-label="Lọc theo tỉnh/thành"
              >
                <option value="">Toàn quốc</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                id="stats-agency"
                className={styles.select}
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                aria-label="Lọc theo lực lượng"
              >
                {AGENCY_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className={styles.segmented} role="group" aria-label="Khoảng thời gian">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={styles.segBtn}
                aria-pressed={preset === p.key}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={preset === 'custom'}
              onClick={() => setPreset('custom')}
            >
              Tuỳ chọn
            </button>
          </div>
          {preset === 'custom' && (
            <>
              <input
                id="stats-from"
                type="date"
                className={styles.input}
                value={custom.from}
                max={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                aria-label="Từ ngày"
              />
              <input
                id="stats-to"
                type="date"
                className={styles.input}
                value={custom.to}
                min={custom.from}
                max={toIsoDay(new Date())}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                aria-label="Đến ngày"
              />
            </>
          )}
        </div>
      </header>

      {dashboard.status === 'loading' && !data && <div className={styles.notice}>Đang tải số liệu...</div>}
      {dashboard.status === 'unavailable' && (
        <div className={styles.notice}>
          <b>Máy chủ chưa có API thống kê</b> (GET /api/v1/dashboard/summary).
        </div>
      )}
      {dashboard.status === 'error' && (
        <div className={styles.notice}>
          <b>Không tải được số liệu:</b> {dashboard.error}{' '}
          <button type="button" className={styles.back} onClick={dashboard.reload}>
            Thử lại
          </button>
        </div>
      )}

      {data && (
        <>
          {/* Only the police escalate (ward -> province); CSGT / PCCC go straight to province */}
          <KpiRow kpis={data.kpis} showEscalation={!data.scope.agency || data.scope.agency === 'police'} />
          <div className={styles.grid}>
            {viewLevel === 'ward' && (
              <Panel title="Sắp leo thang" hint="quá 15' chưa nhận sẽ lên tỉnh">
                <EscalatingList items={dashboard.escalating} />
              </Panel>
            )}
            {viewLevel === 'national' && (
              <>
                <Panel title="Theo lực lượng" hint="số ca trong khoảng thời gian">
                  <AgencyChart byAgency={data.byAgency} />
                </Panel>
                <Panel title="Tỷ lệ nhận trong 15'" hint="theo ngày, vạch vàng = mục tiêu 95%">
                  <SlaTrendChart byDay={data.byDay} />
                </Panel>
                {/* Top row for the command centre: forces, 15' rate, share pie */}
                <SharePanel
                  title="Tỷ trọng"
                  modes={[
                    { key: 'area', label: 'Tỉnh/thành', items: areaSlices(data.byArea) },
                    { key: 'agency', label: 'Lực lượng', items: agencySlices(data.byAgency) },
                  ]}
                />
              </>
            )}
            {viewLevel !== 'ward' && (
              <Panel
                title={viewLevel === 'national' ? 'Xếp hạng tỉnh/thành' : 'Xã/phường cần chú ý'}
                hint="sắp theo số ca leo thang"
                wide
              >
                <AreaTable
                  byArea={data.byArea}
                  areaLabel={viewLevel === 'national' ? 'Tỉnh / thành' : 'Xã / phường'}
                />
              </Panel>
            )}
            {viewLevel === 'province' && (
              <SharePanel
                title="Tỷ trọng"
                modes={[
                  { key: 'agency', label: 'Lực lượng', items: agencySlices(data.byAgency) },
                  { key: 'area', label: 'Xã/phường', items: areaSlices(data.byArea) },
                ]}
              />
            )}
            <Panel title="Theo ngày" hint="tổng ca và ca leo thang">
              <DayChart byDay={data.byDay} />
            </Panel>
            <Panel title="Theo giờ trong ngày" hint="giờ Việt Nam">
              <HourChart byHour={data.byHour} />
            </Panel>
            <Panel title="Theo loại sự cố" hint="nhóm người dân chọn khi báo">
              <TagList byTag={data.byTag} agency={data.scope.agency} />
            </Panel>
            {viewLevel !== 'ward' && (
              <Panel title="Giờ cao điểm" hint="thứ × giờ">
                <Heatmap heatmap={data.heatmap} />
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}
