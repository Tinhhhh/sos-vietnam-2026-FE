import { useEffect, useRef } from 'react';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import styles from './map-style-selector.module.css';

// Each dataset from GET /geo/data-status and the rows it shows (field: version | updated_at | checked_at).
// boundaries = province / ward polygons (date of the geojson files), ward_names = ward names + "merged from"
// synced with bando every 6 hours, rescue_stations = data/rescue_stations.json loaded into the DB.
const DATASETS = [
  {
    key: 'boundaries',
    label: 'Địa giới (ranh giới) 34 Tỉnh · 3.321 Xã/Phường',
    rows: [{ label: 'Ngày cập nhật ranh giới:', field: 'updated_at', dateOnly: true, color: '#4ade80' }],
  },
  {
    key: 'ward_names',
    label: 'Tên xã/phường & thông tin sáp nhập',
    rows: [
      { label: 'Dữ liệu thay đổi gần nhất:', field: 'updated_at', color: '#4ade80' },
      { label: 'Đối chiếu bando lần cuối:', field: 'checked_at' },
    ],
  },
  {
    key: 'rescue_stations',
    label: 'Trụ sở cơ quan & cứu hộ',
    rows: [
      { label: 'Bản dữ liệu:', field: 'version', color: '#4ade80' },
      { label: 'Nạp vào hệ thống:', field: 'updated_at' },
      { label: 'Kiểm tra lần cuối:', field: 'checked_at' },
    ],
  },
];

function formatTime(value, dateOnly = false) {
  if (!value) return 'Chưa có';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  if (dateOnly) return d.toLocaleDateString('vi-VN');
  return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
}

const WARD_SCOPES = [
  { key: 'focus', label: 'Tỉnh đang xem' },
  { key: 'all', label: 'Toàn bộ' },
];

/**
 * Top-right map menu (legacy #mapStyleSelectorPill): base map, the 3 layer
 * shortcuts (ward grid with a scope switch), the read-only national data status
 * and "Định vị GPS hiện trường". Syncing is an admin action and lives elsewhere.
 */
export function MapStyleSelector({
  open,
  onToggle,
  onClose,
  layers,
  onToggleLayer,
  wardScope,
  onWardScopeChange,
  dataStatus,
  locating,
  onLocateGps,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open, onClose]);

  const toggleRows = [
    {
      key: 'wards',
      icon: <SvgIcon name="globe" color="blue" />,
      title: 'Lưới Xã/Phường',
      desc:
        wardScope === 'all'
          ? 'Viền vàng toàn bộ 3.321 xã/phường'
          : 'Viền vàng các xã của tỉnh đang xem (khi phóng to)',
    },
    {
      key: 'provinces',
      icon: <SvgIcon name="building" color="purple" />,
      title: 'Ranh Giới 34 Tỉnh Thành',
      desc: 'Viền phân định & nhãn tỉnh',
    },
    {
      key: 'stations',
      icon: <SvgIcon name="building" color="emerald" />,
      title: 'Trụ Sở Cơ Quan & Cứu Hộ',
      desc: 'Icon Công An, PCCC, Y Tế',
    },
  ];

  return (
    <div
      ref={ref}
      className={`${styles.mapStyleSelectorPill} liquid-glass`}
      title="Thay đổi kiểu nền bản đồ & lớp địa giới"
      style={{ position: 'absolute', cursor: 'pointer', overflow: 'visible' }}
      onClick={onToggle}
    >
      <SvgIcon name="map" color="purple" />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff' }}>Nền VN ⌵</span>

      {open && (
        <div
          className={`${styles.mapStyleDropdownPop} ${styles.mapStyleCustomDropdown}`}
          style={{ display: 'flex' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={styles.mapDropdownSectionTitle}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <SvgIcon name="map" color="purple" /> DẠNG NỀN BẢN ĐỒ
          </div>
          <div className={`${styles.mapStyleOpt} ${styles.isActive}`}>
            <SvgIcon name="map" size="sm" color="purple" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 11.5 }}>Bản Đồ Nền VN (Chuẩn 2026)</div>
              <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 'normal' }}>
                Đường sá, ngõ hẻm tiếng Việt rõ nét
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '6px 0' }} />

          <div
            className={styles.mapDropdownSectionTitle}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <SvgIcon name="file" color="blue" /> LỚP BẢN ĐỒ & ĐỊA GIỚI
          </div>

          {toggleRows.map((row) => (
            <div key={row.key}>
              <div className={styles.mapLayerToggleRow} onClick={() => onToggleLayer(row.key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {row.icon}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 11, color: '#f8fafc' }}>{row.title}</div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{row.desc}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className={styles.mapCustomSwitch}
                  checked={layers[row.key]}
                  onChange={() => onToggleLayer(row.key)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {row.key === 'wards' && layers.wards && (
                <WardScopeSwitch value={wardScope} onChange={onWardScopeChange} />
              )}
            </div>
          ))}

          <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '6px 0' }} />

          <div
            className={styles.mapDropdownSectionTitle}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: dataStatus.items ? '#22c55e' : '#64748b',
                  boxShadow: dataStatus.items ? '0 0 8px #22c55e' : 'none',
                }}
              />
              <span>DỮ LIỆU CSDL QUỐC GIA</span>
            </div>
            <span
              style={{
                fontSize: 8.5,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.12)',
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              CHỈ XEM
            </span>
          </div>

          <DataStatusCard dataStatus={dataStatus} />

          <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexShrink: 0, paddingBottom: 10 }}>
            <button
              type="button"
              className="btn-refresh-loc"
              disabled={locating}
              style={{
                flex: 1,
                flexShrink: 0,
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(56, 189, 248, 0.18)',
                border: '1.5px solid #38bdf8',
                color: '#38bdf8',
                padding: '8px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 8,
                cursor: locating ? 'wait' : 'pointer',
              }}
              onClick={onLocateGps}
            >
              <SvgIcon name="target" color="blue" />{' '}
              {locating ? 'Đang dò tín hiệu GPS...' : 'Định Vị GPS Hiện Trường'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ward grid scope: only the province under the map centre, or every ward. */
function WardScopeSwitch({ value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="Phạm vi lưới xã/phường"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        gap: 4,
        margin: '-2px 6px 6px 34px',
        padding: 3,
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
      }}
    >
      {WARD_SCOPES.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: 10,
              fontWeight: 800,
              borderRadius: 6,
              cursor: 'pointer',
              border: active ? '1px solid rgba(250, 204, 21, 0.6)' : '1px solid transparent',
              background: active ? 'rgba(250, 204, 21, 0.18)' : 'transparent',
              color: active ? '#facc15' : '#94a3b8',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DataStatusCard({ dataStatus }) {
  const byKey = new Map((dataStatus.items || []).map((i) => [i.dataset, i]));

  return (
    <div
      style={{
        padding: '6px 10px',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        margin: '4px 6px 12px 6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#cbd5e1',
          marginBottom: 6,
        }}
      >
        <span>Nguồn chính thức:</span>
        <a
          href="https://sapnhap.bando.com.vn"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#fde047', textDecoration: 'none', fontWeight: 700 }}
        >
          bando.com.vn ↗
        </a>
      </div>

      {dataStatus.loading && <div style={{ fontSize: 9.5, color: '#94a3b8' }}>Đang tải thông tin...</div>}
      {!dataStatus.loading && !dataStatus.items && (
        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
          Máy chủ chưa cung cấp thông tin phiên bản dữ liệu.
        </div>
      )}

      {dataStatus.items &&
        DATASETS.map((ds) => {
          const item = byKey.get(ds.key);
          return (
            <div
              key={ds.key}
              style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 5, marginTop: 5 }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, color: '#f8fafc', marginBottom: 3 }}>
                {ds.label}
              </div>
              {ds.rows.map((row) => (
                <StatusRow
                  key={row.field}
                  label={row.label}
                  value={
                    row.field === 'version'
                      ? item?.version || 'Chưa có'
                      : formatTime(item?.[row.field], row.dateOnly)
                  }
                  color={row.color}
                />
              ))}
            </div>
          );
        })}
    </div>
  );
}

function StatusRow({ label, value, color = '#cbd5e1' }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        fontSize: 9.5,
        color: '#94a3b8',
        marginBottom: 2,
      }}
    >
      <span>{label}</span>
      <span style={{ color, fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
