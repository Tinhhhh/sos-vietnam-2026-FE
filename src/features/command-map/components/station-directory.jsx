import { useMemo, useState } from 'react';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import { normalizeProvinceName } from '../utils/geo-math';
import { stationMatchesAgency } from '../utils/station-model';
import styles from './station-directory.module.css';

const LEGACY_REGIONS = ['Cần Thơ', 'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'];
const REGION_SHORT = { 'TP. Hồ Chí Minh': 'TP.HCM' };
const RENDER_LIMIT = 200;

const AGENCY_LOOK = {
  police: { icon: '👮‍♂️', color: '#60a5fa' },
  csgt: { icon: '🚗', color: '#fbbf24' },
  fire: { icon: '🚒', color: '#f87171' },
  hospital: { icon: '🚑', color: '#34d399' },
  'traffic-rescue': { icon: '🛠️', color: '#fb923c' },
};

/**
 * Sidebar tab with the station directory (legacy #panelStationsView). Officers
 * only see their own agency; the region defaults to their province.
 *
 * @param {{
 *   officer: { agency: string, province: string|null, isAdmin: boolean },
 *   stations: object[], status: 'loading'|'ready'|'error',
 *   onFlyTo: (station) => void, onAdminAction?: (action: string) => void,
 * }} props
 */
export function StationDirectory({ officer, stations, status, onFlyTo, onAdminAction }) {
  const regions = useMemo(() => {
    const own =
      officer.province &&
      !LEGACY_REGIONS.some((r) => normalizeProvinceName(r) === normalizeProvinceName(officer.province));
    return [...(own ? [officer.province] : []), ...LEGACY_REGIONS];
  }, [officer.province]);
  const [region, setRegion] = useState(() => {
    if (officer.isAdmin || !officer.province) return 'all';
    return regions.find((r) => normalizeProvinceName(r) === normalizeProvinceName(officer.province)) || 'all';
  });
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    const q = keyword.toLowerCase().trim();
    return stations
      .filter((s) => stationMatchesAgency(s, officer.agency))
      .filter((s) => region === 'all' || normalizeProvinceName(s.province) === normalizeProvinceName(region))
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q) ||
          s.ward.toLowerCase().includes(q),
      );
  }, [stations, officer.agency, region, keyword]);

  return (
    <div
      className={styles.panelStationsView}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '12px 14px' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {[...regions, 'all'].map((r) => (
          <button
            key={r}
            type="button"
            className={`btn-refresh-loc ${styles.stationRegionBtn} ${region === r ? `${styles.isActive} is-active` : ''}`}
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setRegion(r)}
          >
            {r === 'all' ? 'Tất cả' : REGION_SHORT[r] || r}
          </button>
        ))}
      </div>

      {officer.isAdmin && (
        <button
          type="button"
          className={`btn-refresh-loc ${styles.btnAddNewStationPick}`}
          style={{
            width: '100%',
            justifyContent: 'center',
            background: 'rgba(0, 210, 255, 0.15)',
            borderColor: '#00d2ff',
            color: '#38bdf8',
            fontWeight: 700,
            fontSize: 11,
            padding: 7,
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
          onClick={() => onAdminAction?.('add-station')}
        >
          <SvgIcon name="plus" color="blue" /> Chấm Thêm Trụ Sở Mới Trên Bản Đồ
        </button>
      )}

      <input
        type="text"
        className="input-field"
        placeholder="Tìm trụ sở, phường, SĐT..."
        style={{ marginBottom: 10, padding: '8px 10px', fontSize: 12 }}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />

      <div className={styles.stationsListContainer} style={{ overflowY: 'auto', flex: 1, paddingRight: 2 }}>
        {status === 'loading' && <EmptyState icon="⏳" text="Đang nạp danh bạ trụ sở..." />}
        {status === 'error' && <EmptyState icon="⚠️" text="Không tải được danh bạ trụ sở từ máy chủ" />}
        {status === 'ready' && filtered.length === 0 && (
          <EmptyState icon="🏢" text="Không tìm thấy trụ sở nào phù hợp với đơn vị của bạn" />
        )}

        {filtered.slice(0, RENDER_LIMIT).map((st) => (
          <StationCard
            key={st.id}
            station={st}
            isAdmin={officer.isAdmin}
            onFlyTo={onFlyTo}
            onAdminAction={onAdminAction}
          />
        ))}

        {filtered.length > RENDER_LIMIT && (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 10.5, padding: '8px 0 14px' }}>
            Đang hiện {RENDER_LIMIT}/{filtered.length} trụ sở — gõ từ khoá hoặc chọn tỉnh để thu hẹp.
          </div>
        )}
      </div>
    </div>
  );
}

function StationCard({ station: st, isAdmin, onFlyTo, onAdminAction }) {
  const look = AGENCY_LOOK[st.agency] || AGENCY_LOOK.police;
  return (
    <div className={styles.stationCard}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 6,
          width: '100%',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: look.color,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            flex: '1 1 auto',
            minWidth: 0,
            wordBreak: 'break-word',
            lineHeight: 1.35,
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 1 }}>{look.icon}</span>{' '}
          <span style={{ wordBreak: 'break-word' }}>{st.name}</span>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
            <button
              type="button"
              className={`btn-refresh-loc ${styles.btnEditStation}`}
              style={{
                padding: '2px 7px',
                fontSize: 10,
                borderColor: 'rgba(255,255,255,0.2)',
                whiteSpace: 'nowrap',
              }}
              onClick={() => onAdminAction?.('edit-station')}
            >
              ✏️ Sửa
            </button>
            <button
              type="button"
              className={`btn-refresh-loc ${styles.btnDeleteStation}`}
              style={{
                padding: '2px 7px',
                fontSize: 10,
                background: 'rgba(255, 42, 75, 0.15)',
                borderColor: '#ff2a4b',
                color: '#ff6b81',
                whiteSpace: 'nowrap',
              }}
              onClick={() => onAdminAction?.('delete-station')}
            >
              🗑️ Xóa
            </button>
          </div>
        )}
      </div>
      <div
        style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 4, lineHeight: 1.4, wordBreak: 'break-word' }}
      >
        📍 <b>Địa chỉ:</b> {st.address || 'Chưa cập nhật'}
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#94a3b8',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span>
          ☎️ <b>SĐT bàn:</b>{' '}
          {st.phone ? (
            <a href={`tel:${st.phone}`} style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'none' }}>
              {st.phone}
            </a>
          ) : (
            'Chưa cập nhật'
          )}
        </span>
      </div>
      {st.officer && (
        <div style={{ fontSize: 11, color: '#a78bfa', marginBottom: 6, wordBreak: 'break-word' }}>
          👤 <b>Phụ trách:</b> {st.officer}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
        <button
          type="button"
          className={`btn-refresh-loc ${styles.btnFlyStation}`}
          style={{
            justifyContent: 'center',
            fontSize: 10,
            background: 'rgba(0, 136, 255, 0.15)',
            borderColor: '#0088ff',
            color: '#60a5fa',
          }}
          onClick={() => onFlyTo(st)}
        >
          🗺️ Xem Trên Map
        </button>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-refresh-loc"
          style={{
            justifyContent: 'center',
            fontSize: 10,
            background: 'rgba(66, 133, 244, 0.15)',
            borderColor: '#4285f4',
            color: '#93c5fd',
            textDecoration: 'none',
          }}
        >
          🚗 Google Maps
        </a>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px 10px' }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div>{text}</div>
    </div>
  );
}

/**
 * Admin-only tabs "Cứu Hộ" / "Bệnh Viện" (legacy #panelEnterprisesView, #panelHospitalsView).
 * The directories themselves come with the admin module.
 */
export function ServiceDirectoryPanel({ kind, onAdminAction }) {
  const isHospital = kind === 'hospitals';
  return (
    <div
      className={isHospital ? styles.panelHospitalsView : styles.panelEnterprisesView}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '12px 14px' }}
    >
      <button
        type="button"
        className={`btn-refresh-loc ${isHospital ? styles.btnAddNewHospitalModal : styles.btnAddNewEnterpriseModal}`}
        style={{
          width: '100%',
          justifyContent: 'center',
          background: isHospital ? 'rgba(16, 185, 129, 0.2)' : 'rgba(249, 115, 22, 0.2)',
          borderColor: isHospital ? '#10b981' : '#f97316',
          color: isHospital ? '#34d399' : '#fb923c',
          fontWeight: 700,
          fontSize: 11,
          padding: 7,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
        onClick={() => onAdminAction?.(isHospital ? 'add-hospital' : 'add-enterprise')}
      >
        <SvgIcon name="plus" color={isHospital ? 'emerald' : 'amber'} />{' '}
        {isHospital ? 'Đăng Ký / Thêm Bệnh Viện & Trạm 115' : 'Đăng Ký / Cấp Phép Doanh Nghiệp Mới'}
      </button>
      <input
        type="text"
        className="input-field"
        placeholder={
          isHospital
            ? 'Tìm tên bệnh viện, địa chỉ, chuyên khoa...'
            : 'Tìm tên gara, số điện thoại, tỉnh thành...'
        }
        style={{ marginBottom: 10, padding: '8px 10px', fontSize: 12 }}
      />
      <div
        className={isHospital ? styles.hospitalsListContainer : styles.enterprisesListContainer}
        style={{ overflowY: 'auto', flex: 1, paddingRight: 2 }}
      >
        <EmptyState
          icon={isHospital ? '🏥' : '🛠️'}
          text={
            isHospital
              ? 'Danh bạ bệnh viện & trạm 115 chưa có dữ liệu'
              : 'Danh bạ doanh nghiệp cứu hộ chưa có dữ liệu'
          }
        />
      </div>
    </div>
  );
}
