import { useMemo, useState } from 'react';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import { normalizeProvinceName } from '../utils/geo-math';
import { stationMatchesAgency } from '../utils/station-model';
import styles from './station-directory.module.css';

const RENDER_LIMIT = 200;

const AGENCY_LOOK = {
  police: { icon: '👮‍♂️', color: '#60a5fa', label: 'Công an' },
  csgt: { icon: '🚗', color: '#fbbf24', label: 'CSGT' },
  fire: { icon: '🚒', color: '#f87171', label: 'PCCC' },
  hospital: { icon: '🚑', color: '#34d399', label: 'Y tế' },
};
const AGENCIES = ['police', 'csgt', 'fire', 'hospital'];

/**
 * Sidebar tab with the station directory. Officers only see their own agency; ADMIN picks one of the 4 forces
 * (tabs) and sees only that force. The province list holds the provinces of that force, defaulting to the
 * officer's own province (ADMIN: all).
 *
 * @param {{
 *   officer: { agency: string, province: string|null, isAdmin: boolean },
 *   stations: object[], status: 'loading'|'ready'|'error',
 *   onFlyTo: (station) => void, onAdminAction?: (action: string) => void,
 * }} props
 */
export function StationDirectory({ officer, stations, status, onFlyTo, onAdminAction }) {
  const pickAgency = officer.isAdmin || officer.agency === 'all';
  const [agencyTab, setAgencyTab] = useState('police');
  const agency = pickAgency ? agencyTab : officer.agency;
  const [province, setProvince] = useState(() =>
    officer.isAdmin || !officer.province ? 'all' : officer.province,
  );
  const [keyword, setKeyword] = useState('');

  const ofAgency = useMemo(() => stations.filter((s) => stationMatchesAgency(s, agency)), [stations, agency]);
  const counts = useMemo(() => {
    const c = {};
    stations.forEach((s) => {
      c[s.agency] = (c[s.agency] || 0) + 1;
    });
    return c;
  }, [stations]);
  const provinces = useMemo(() => {
    const names = new Map();
    ofAgency.forEach((s) => s.province && names.set(normalizeProvinceName(s.province), s.province));
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [ofAgency]);
  const provinceKey = province === 'all' ? null : normalizeProvinceName(province);
  // the chosen province may have no station of the newly picked force: show all instead of an empty list
  const activeProvince =
    provinceKey && provinces.some((p) => normalizeProvinceName(p) === provinceKey) ? provinceKey : null;

  const filtered = useMemo(() => {
    const q = keyword.toLowerCase().trim();
    return ofAgency
      .filter((s) => !activeProvince || normalizeProvinceName(s.province) === activeProvince)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q) ||
          s.ward.toLowerCase().includes(q),
      );
  }, [ofAgency, activeProvince, keyword]);

  return (
    <div className={`${styles.panelStationsView} ${styles.panel}`}>
      {pickAgency && (
        <div className={styles.agencyTabs} role="tablist" aria-label="Lực lượng">
          {AGENCIES.map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={agency === a}
              className={`${styles.agencyTab} ${agency === a ? styles.agencyTabOn : ''}`}
              style={{ '--agency': AGENCY_LOOK[a].color }}
              onClick={() => setAgencyTab(a)}
            >
              <span aria-hidden="true">{AGENCY_LOOK[a].icon}</span>
              <span className={styles.agencyTabLabel}>{AGENCY_LOOK[a].label}</span>
              <span className={styles.agencyTabCount}>{counts[a] || 0}</span>
            </button>
          ))}
        </div>
      )}

      {officer.isAdmin && (
        <button type="button" className={styles.addBtn} onClick={() => onAdminAction?.('add-station')}>
          <SvgIcon name="plus" color="blue" /> Chấm thêm trụ sở mới trên bản đồ
        </button>
      )}

      <div className={styles.filters}>
        <select
          className={`input-field ${styles.province}`}
          aria-label="Tỉnh / thành phố"
          value={activeProvince ? province : 'all'}
          onChange={(e) => setProvince(e.target.value)}
        >
          <option value="all">Tất cả tỉnh / thành</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          type="text"
          className={`input-field ${styles.search}`}
          placeholder="Tìm trụ sở, phường, SĐT..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className={styles.listInfo}>
        {status === 'ready' && `${filtered.length} trụ sở ${AGENCY_LOOK[agency]?.label || ''}`}
      </div>

      <div className={`${styles.stationsListContainer} ${styles.list}`}>
        {status === 'loading' && <EmptyState icon="⏳" text="Đang nạp danh bạ trụ sở..." />}
        {status === 'error' && <EmptyState icon="⚠️" text="Không tải được danh bạ trụ sở từ máy chủ" />}
        {status === 'ready' && filtered.length === 0 && (
          <EmptyState icon="🏢" text="Không tìm thấy trụ sở nào phù hợp" />
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
          <div className={styles.more}>
            Đang hiện {RENDER_LIMIT}/{filtered.length} trụ sở — gõ từ khoá hoặc chọn tỉnh để thu hẹp.
          </div>
        )}
      </div>
    </div>
  );
}

/** One station: name (full width), address / phone / officer, then the map buttons; ADMIN edit / delete below. */
function StationCard({ station: st, isAdmin, onFlyTo, onAdminAction }) {
  const look = AGENCY_LOOK[st.agency] || AGENCY_LOOK.police;
  return (
    <article className={styles.stationCard} style={{ '--agency': look.color }}>
      <h4 className={styles.cardName}>
        <span aria-hidden="true">{look.icon}</span>
        <span>{st.name}</span>
      </h4>
      <dl className={styles.cardInfo}>
        <div>
          <dt>📍 Địa chỉ</dt>
          <dd>{st.address || 'Chưa cập nhật'}</dd>
        </div>
        <div>
          <dt>☎️ SĐT</dt>
          <dd>
            {st.phone ? (
              <a href={`tel:${st.phone}`} className={styles.phone}>
                {st.phone}
              </a>
            ) : (
              'Chưa cập nhật'
            )}
          </dd>
        </div>
        {st.officer && (
          <div>
            <dt>👤 Phụ trách</dt>
            <dd className={styles.officer}>{st.officer}</dd>
          </div>
        )}
      </dl>
      <div className={styles.cardActions}>
        <button type="button" className={styles.mapBtn} onClick={() => onFlyTo(st)}>
          🗺️ Xem trên bản đồ
        </button>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mapBtn}
        >
          🚗 Google Maps
        </a>
        {isAdmin && (
          <>
            <button type="button" className={styles.editBtn} onClick={() => onAdminAction?.('edit-station')}>
              ✏️ Sửa
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onAdminAction?.('delete-station')}
            >
              🗑️ Xoá
            </button>
          </>
        )}
      </div>
    </article>
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
