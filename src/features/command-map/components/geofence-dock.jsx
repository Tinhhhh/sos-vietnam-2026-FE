import { useEffect, useMemo, useRef, useState } from 'react';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import { PROVINCE_REGION, REGION_TABS, provinceIcon } from '../data/province-regions';
import { normalizeProvinceName } from '../utils/geo-math';
import styles from './geofence-dock.module.css';

const WARD_RESULTS_LIMIT = 80;
const WARD_PREFIX_RE = /^(phường|xã|thị trấn|đặc khu|p\.|x\.|tt\.)\s*/i;
const UNIT_PREFIX_RE = /^(công an|ca)\s+(phường|xã|thị trấn|đặc khu)\s*/i;

// The popover is a height-capped flex column: only the list may shrink/scroll, never these rows.
const FIXED_ROW = { flexShrink: 0 };

const cleanWard = (s) =>
  (s || '').toLowerCase().replace(UNIT_PREFIX_RE, '').replace(WARD_PREFIX_RE, '').trim();

/**
 * "Địa bàn" dock at the bottom of the map (legacy #tacticalGeofenceControlBar):
 * a glass bubble that expands into province / ward pickers.
 *
 * @param {{
 *   provinces: { name: string, center: number[] }[] | null,
 *   wardsByProvince: Map<string, object[]> | null,
 *   ensureWards: () => Promise<Map<string, object[]>>,
 *   stations: object[],
 *   selectedProvince: string,
 *   selectedWard: object | null,
 *   areaGridVisible: boolean,
 *   onSelectProvince: (name: string) => void,
 *   onSelectWard: (ward: object) => void,
 *   onToggleAreaGrid: () => void,
 *   onClear: () => void,
 * }} props
 */
export function GeofenceDock({
  provinces,
  wardsByProvince,
  ensureWards,
  stations,
  selectedProvince,
  selectedWard,
  areaGridVisible,
  onSelectProvince,
  onSelectWard,
  onToggleAreaGrid,
  onClear,
}) {
  const [expanded, setExpanded] = useState(false);
  const [anim, setAnim] = useState('');
  const [popover, setPopover] = useState(null); // 'province' | 'ward' | null
  const [region, setRegion] = useState('all');
  const [provinceQuery, setProvinceQuery] = useState('');
  const [wardQuery, setWardQuery] = useState('');
  const rootRef = useRef(null);

  // Close popovers on outside click (legacy document click handler).
  useEffect(() => {
    if (!popover) return undefined;
    const close = (e) => {
      if (!rootRef.current?.contains(e.target)) setPopover(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [popover]);

  const expand = (e) => {
    e.stopPropagation();
    setExpanded(true);
    setAnim('expanding');
    setTimeout(() => setAnim(''), 400);
  };

  const minimize = (e) => {
    e.stopPropagation();
    setPopover(null);
    setAnim('shrinking');
    setTimeout(() => {
      setAnim('');
      setExpanded(false);
    }, 240);
  };

  const openWardPopover = (e) => {
    e.stopPropagation();
    setPopover((p) => (p === 'ward' ? null : 'ward'));
    ensureWards().catch(() => {});
  };

  const wardCount = (name) => wardsByProvince?.get(normalizeProvinceName(name))?.length;

  const provinceList = useMemo(() => {
    const q = provinceQuery.toLowerCase().trim();
    return (provinces || [])
      .filter((p) => region === 'all' || PROVINCE_REGION[p.name] === region)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [provinces, region, provinceQuery]);

  const regionCount = (key) =>
    key === 'all'
      ? (provinces?.length ?? 34)
      : (provinces || []).filter((p) => PROVINCE_REGION[p.name] === key).length;

  // Ward police stations, for the address/phone line of each ward card.
  const wardStationIndex = useMemo(() => {
    const index = new Map();
    for (const st of stations) {
      if (st.level !== 'ward' || st.agency !== 'police') continue;
      const key = `${normalizeProvinceName(st.province)}|${cleanWard(st.ward || st.name)}`;
      // The seed has auto-generated placeholders next to real units: prefer one with a phone.
      if (!index.has(key) || (!index.get(key).phone && st.phone)) index.set(key, st);
    }
    return index;
  }, [stations]);

  const wardList = useMemo(() => {
    if (!wardsByProvince) return null;
    const q = wardQuery.toLowerCase().trim();
    const source = selectedProvince
      ? wardsByProvince.get(normalizeProvinceName(selectedProvince)) || []
      : [...wardsByProvince.values()].flat();
    return source.filter(
      (w) => !q || w.name.toLowerCase().includes(q) || w.province.toLowerCase().includes(q),
    );
  }, [wardsByProvince, wardQuery, selectedProvince]);

  const pickProvince = (name) => {
    setPopover(null);
    setWardQuery('');
    onSelectProvince(name);
  };

  const pickWard = (ward) => {
    setPopover(null);
    onSelectWard(ward);
  };

  const hasSelection = Boolean(selectedProvince || selectedWard);
  const areaLabel = selectedWard
    ? areaGridVisible
      ? 'Đang Hiện Lưới Địa Bàn'
      : 'Đang Tắt Lưới Địa Bàn'
    : areaGridVisible
      ? selectedProvince
        ? 'Đang Hiện Lưới Tỉnh'
        : 'Đang Hiện Lưới Khu Vực'
      : 'Đang Tắt Lưới 34 Tỉnh';

  return (
    <div ref={rootRef}>
      {!expanded && (
        <div
          className={`${styles.geofenceBubbleOrb} ${styles.tacticalGeofenceBubbleTrigger}`}
          title="Khoanh vùng 34 Tỉnh Thành & 3.321 Xã/Phường (Bấm để mở)"
          onClick={expand}
        >
          <div className={styles.geofenceBubbleGlassReflect} />
          <span
            className={styles.geofenceBubbleIcon}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <SvgIcon name="globe" size="sm" color="blue" />
          </span>
          <div className={styles.geofenceBubbleLabelTag}>Địa bàn</div>
        </div>
      )}

      {expanded && (
        <div
          className={`${styles.tacticalBottomDock} ${styles.tacticalGeofenceControlBar} ${anim === 'expanding' ? styles.isExpanding : ''} ${anim === 'shrinking' ? styles.isShrinking : ''}`}
          style={{ display: 'inline-flex' }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className={styles.dockTitleTag}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontWeight: 800,
              fontSize: 11,
              color: '#f43f5e',
              padding: '0 4px',
              whiteSpace: 'nowrap',
              textShadow: '0 0 10px rgba(244, 63, 94, 0.4)',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            <SvgIcon name="pin" color="red" /> <span className={styles.dockTitleText}>ĐỊA BÀN:</span>
          </div>

          <div
            className={styles.dockPillSelectWrap}
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              setPopover((p) => (p === 'province' ? null : 'province'));
            }}
          >
            <span className={styles.dockPillIcon}>
              <SvgIcon name="star" color="blue" />
            </span>
            <span
              className={styles.dockProvinceLabel}
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 125,
              }}
            >
              {selectedProvince || `-- Chọn ${provinces?.length ?? 34} Tỉnh / TP --`}
            </span>
            <span className={styles.dockPillChevron}>⌵</span>
          </div>

          <div
            className={styles.dockPillSelectWrap}
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={openWardPopover}
          >
            <span className={styles.dockPillIcon}>
              <SvgIcon name="pin" color="blue" />
            </span>
            <span
              className={styles.dockWardLabel}
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: '#38bdf8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 135,
              }}
            >
              {selectedWard?.name ||
                (selectedProvince ? `-- Chọn Xã/Phường (${selectedProvince}) --` : '-- Chọn Xã / Phường --')}
            </span>
            <span className={styles.dockPillChevron}>⌵</span>
          </div>

          <button
            type="button"
            className={styles.dockPillButton}
            title="Bật/Tắt hiển thị lưới ranh giới địa bàn / tỉnh thành đang chọn"
            style={
              areaGridVisible
                ? {
                    background: 'rgba(234, 179, 8, 0.2)',
                    border: '1px solid rgba(234, 179, 8, 0.5)',
                    color: '#facc15',
                  }
                : {
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#94a3b8',
                  }
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleAreaGrid();
            }}
          >
            <span className={styles.dockPillIcon}>
              <SvgIcon name={areaGridVisible ? 'eye' : 'eyeOff'} color="amber" />
            </span>
            <span className={styles.labelToggleAreaGrid}>{areaLabel}</span>
          </button>

          {hasSelection && (
            <button
              type="button"
              className={styles.dockPillButton}
              style={{
                display: 'inline-flex',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#fca5a5',
                alignItems: 'center',
                gap: 4,
              }}
              title="Bỏ chọn khoanh vùng"
              onClick={(e) => {
                e.stopPropagation();
                setWardQuery('');
                onClear();
              }}
            >
              <SvgIcon name="x" color="red" /> Bỏ vùng
            </button>
          )}

          <button
            type="button"
            className={styles.dockMinimizeBtn}
            title="Thu nhỏ về quả cầu bong bóng trong suốt"
            onClick={minimize}
          >
            <SvgIcon name="x" color="white" />
          </button>
        </div>
      )}

      {expanded && popover === 'province' && (
        <div
          className={`${styles.liquidGlassPopover} ${styles.provinceBubblePopover}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.popoverHeader} style={FIXED_ROW}>
            <div className={styles.popoverTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SvgIcon name="star" size="sm" color="blue" /> ĐỊA GIỚI {provinces?.length ?? 34} TỈNH & THÀNH
              PHỐ
            </div>
            <button type="button" className={styles.popoverCloseBtn} onClick={() => setPopover(null)}>
              <SvgIcon name="x" color="white" />
            </button>
          </div>
          <div className={styles.popoverSearchWrap} style={FIXED_ROW}>
            <input
              type="text"
              placeholder="Gõ tên tỉnh/thành để lọc nhanh..."
              className={styles.popoverSearchInput}
              value={provinceQuery}
              onChange={(e) => setProvinceQuery(e.target.value)}
            />
          </div>
          <div className={styles.popoverFilterTabs} style={FIXED_ROW}>
            {REGION_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.popoverTabBtn} ${region === tab.key ? styles.isActive : ''}`}
                onClick={() => setRegion(tab.key)}
              >
                {tab.label} ({regionCount(tab.key)})
              </button>
            ))}
          </div>
          <div className={styles.provinceBubblesGrid}>
            {!provinces && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: 11,
                  padding: 20,
                }}
              >
                ⏳ Đang nạp địa giới...
              </div>
            )}
            {provinces && provinceList.length === 0 && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: 11,
                  padding: 20,
                }}
              >
                Không tìm thấy tỉnh thành phù hợp
              </div>
            )}
            {provinceList.map((p) => (
              <div
                key={p.name}
                className={`${styles.provinceBubblePill} ${selectedProvince === p.name ? styles.isSelected : ''}`}
                onClick={() => pickProvince(p.name)}
              >
                <div className={styles.provinceBubbleName}>
                  <span>{provinceIcon(p.name)}</span>
                  <span>{p.name}</span>
                </div>
                {wardCount(p.name) != null && (
                  <span className={styles.provinceBubbleCount}>{wardCount(p.name)} ĐV</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && popover === 'ward' && (
        <div
          className={`${styles.liquidGlassPopover} ${styles.wardPopover} ${styles.wardBubblePopover}`}
          style={{ width: 450, maxWidth: '92vw' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.popoverHeader} style={FIXED_ROW}>
            <div className={styles.popoverTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SvgIcon name="pin" color="blue" />{' '}
              {selectedProvince
                ? `XÃ / PHƯỜNG TRỰC THUỘC ${selectedProvince.toUpperCase()}`
                : 'XÃ / PHƯỜNG TOÀN QUỐC (3.321 ĐV)'}
            </div>
            <button type="button" className={styles.popoverCloseBtn} onClick={() => setPopover(null)}>
              <SvgIcon name="x" color="white" />
            </button>
          </div>
          <div className={styles.popoverSearchWrap} style={FIXED_ROW}>
            <input
              type="text"
              placeholder={
                selectedProvince
                  ? `🔍 Tìm xã/phường tại ${selectedProvince}...`
                  : 'Tìm tên xã/phường, thị trấn...'
              }
              className={styles.popoverSearchInput}
              autoComplete="off"
              value={wardQuery}
              onChange={(e) => setWardQuery(e.target.value)}
            />
          </div>
          <div className={styles.wardResultsList}>
            {!wardList && (
              <div style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: 15 }}>
                ⏳ Đang nạp danh sách xã/phường...
              </div>
            )}
            {wardList && wardList.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: 20 }}>
                Không tìm thấy xã/phường nào phù hợp
              </div>
            )}
            {wardList?.slice(0, WARD_RESULTS_LIMIT).map((w) => {
              const st = wardStationIndex.get(`${normalizeProvinceName(w.province)}|${cleanWard(w.name)}`);
              const phone = st?.phone || '';
              return (
                <div
                  key={w.id}
                  className={styles.wardResultCard}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: 12,
                    marginBottom: 8,
                    background: 'rgba(24, 24, 27, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                  onClick={() => pickWard(w)}
                >
                  <img
                    src="/assets/iconcongan.png"
                    style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0, marginTop: 2 }}
                    alt="Huy hiệu CAND"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 13.5,
                        color: '#ffffff',
                        lineHeight: 1.3,
                        marginBottom: 3,
                      }}
                    >
                      {w.name}{' '}
                      <span style={{ fontSize: 10.5, color: '#38bdf8', fontWeight: 'normal' }}>
                        ({w.province})
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#cbd5e1',
                        lineHeight: 1.4,
                        marginBottom: 4,
                        wordBreak: 'break-word',
                      }}
                    >
                      📍 {st?.address || 'Chưa cập nhật trụ sở'}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: '#ea580c', fontWeight: 700 }}>📞 {phone || 'Chưa cập nhật'}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    {phone && (
                      <a
                        href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: '#166534',
                          border: '1px solid #22c55e',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          textDecoration: 'none',
                          fontSize: 13,
                        }}
                        title="Gọi số trực"
                      >
                        📞
                      </a>
                    )}
                    <span
                      style={{
                        fontSize: 9.5,
                        color: '#facc15',
                        fontWeight: 800,
                        background: 'rgba(250,204,21,0.15)',
                        border: '1px solid rgba(250,204,21,0.3)',
                        padding: '2px 6px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Khoanh Vùng ↗
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
