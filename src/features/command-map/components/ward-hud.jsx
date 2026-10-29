import { useRef, useState } from 'react';

import place from './ward-hud-place.module.css';
import styles from './ward-hud.module.css';

const MISSING = 'Chưa cập nhật';

const LEVEL_LABEL = { province: 'Cấp tỉnh / thành phố', ward: 'Cấp xã / phường', enterprise: 'Doanh nghiệp' };
const AGENCY_LABEL = {
  police: 'Công an',
  csgt: 'Cảnh sát giao thông',
  fire: 'PCCC & CNCH',
  hospital: 'Y tế',
};

function gmapsUrl(station, origin) {
  if (!station) return 'https://www.google.com/maps';
  const from = origin ? `&origin=${origin.lat},${origin.lng}` : '';
  return `https://www.google.com/maps/dir/?api=1${from}&destination=${station.lat},${station.lng}`;
}

function provinceTitle(name) {
  if (/^(TP\.|Thành phố|Tỉnh|Thủ đô)/.test(name)) return name;
  const isCity = ['Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế'].includes(name);
  return `${isCity ? 'Thành phố' : 'Tỉnh'} ${name}`;
}

/**
 * Info card for the selected ward / province unit (legacy #tacticalWardGeofenceHud,
 * showWardHud + showProvinceHud). Legacy filled gaps with sample data (a Cần Thơ
 * officer, phone, population...); here missing fields say "Chưa cập nhật".
 *
 * @param {{
 *   selection: {
 *     kind: 'ward' | 'province',
 *     wardName?: string, provinceName: string, sapNhapTu?: string|null,
 *     station: object|null, facilities?: object[],
 *   },
 *   origin?: { lat: number, lng: number } | null,
 *   onPickFacility?: (station) => void,
 *   onClose: () => void,
 * }} props
 */
export function WardHud({ selection, origin, onPickFacility, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const [picked, setPicked] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const ref = useRef(null);
  const facilities = selection.facilities || [];
  const station = (picked && facilities.find((f) => f.id === picked)) || selection.station;
  const isProvince = selection.kind === 'province';

  const title =
    station?.name || (isProvince ? `Công An ${provinceTitle(selection.provinceName)}` : selection.wardName);
  const address = station?.address || MISSING;
  const phone = station?.phone || '';
  const cleanPhone = phone.replace(/[^0-9+]/g, '');

  // Drag by the header like the console windows; stays inside the map.
  const startDrag = (e) => {
    if (e.button !== 0 || e.target.closest('button, a')) return;
    const el = ref.current;
    const area = el?.parentElement;
    if (!el || !area) return;
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, x: offset.x, y: offset.y };
    const rect = el.getBoundingClientRect();
    const box = area.getBoundingClientRect();
    const min = { x: start.x + box.left - rect.left, y: start.y + box.top - rect.top };
    const max = { x: start.x + box.right - rect.right, y: start.y + box.bottom - rect.top - 44 };
    const move = (ev) => {
      const x = Math.min(Math.max(start.x + ev.clientX - start.px, min.x), Math.max(min.x, max.x));
      const y = Math.min(Math.max(start.y + ev.clientY - start.py, min.y), Math.max(min.y, max.y));
      setOffset({ x, y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const pick = (fac) => {
    setPicked(fac.id);
    onPickFacility?.(fac);
  };

  return (
    <div
      ref={ref}
      className={`${styles.tacticalWardGeofenceHud} ${place.right} ${minimized ? styles.isMinimized : ''}`}
      style={{
        fontFamily: "'Hubot Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: '#1c1917',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        padding: '10px 12px',
        color: '#ffffff',
        minWidth: 280,
        maxWidth: 345,
        boxShadow: '0 10px 30px rgba(0,0,0,0.85)',
        textAlign: 'left',
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      <div
        onPointerDown={startDrag}
        title="Kéo để di chuyển"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 6,
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
          <img
            src="/assets/iconcongan.png"
            style={{
              width: 30,
              height: 30,
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.5))',
            }}
            alt="Huy hiệu CAND"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'clamp(13.5px, 1.1vw, 15.5px)',
                fontWeight: 800,
                color: '#ea580c',
                lineHeight: 1.2,
                marginBottom: 2,
                wordBreak: 'break-word',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 'clamp(11px, 0.85vw, 11.8px)',
                color: '#f4f4f5',
                lineHeight: 1.35,
                wordBreak: 'break-word',
              }}
            >
              {address}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#e2e8f0',
              fontSize: 10.5,
              fontWeight: 800,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              whiteSpace: 'nowrap',
            }}
            title="Thu gọn / Mở rộng bảng thông tin"
          >
            <span>{minimized ? '▸' : '▾'}</span> Thu gọn
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 5,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Đóng HUD"
          >
            ✕
          </button>
        </div>
      </div>

      <div>
        <div
          style={{
            marginTop: 7,
            marginBottom: 6,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 700 }}>Số điện thoại trực:</div>
          {phone ? (
            <a href={`tel:${cleanPhone}`} style={{ textDecoration: 'none', display: 'inline-block' }}>
              <div
                style={{
                  color: '#22c55e',
                  fontSize: 'clamp(17px, 1.35vw, 20px)',
                  fontWeight: 900,
                  letterSpacing: 0.4,
                  textShadow: '0 0 10px rgba(34, 197, 94, 0.35)',
                  lineHeight: 1.1,
                }}
              >
                {phone}
              </div>
            </a>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>{MISSING}</div>
          )}
        </div>

        <hr style={{ border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.14)', margin: '5px 0 6px 0' }} />

        <div
          style={{
            fontSize: 'clamp(11px, 0.85vw, 11.8px)',
            color: '#f4f4f5',
            lineHeight: 1.45,
            marginBottom: 8,
          }}
        >
          <div style={{ marginBottom: 2 }}>
            <b>- {isProvince ? 'Chỉ huy' : 'Trưởng CA'}:</b> <span>{station?.officer || MISSING}</span>
          </div>
          <div style={{ marginBottom: 2 }}>
            <b>- Email:</b>{' '}
            {station?.email ? (
              <a
                href={`mailto:${station.email}`}
                style={{ color: '#60a5fa', textDecoration: 'none', wordBreak: 'break-all' }}
              >
                {station.email}
              </a>
            ) : (
              <span>{MISSING}</span>
            )}
          </div>
          <div>
            <b>- Lĩnh vực:</b> <span>{station?.services || MISSING}</span>
          </div>
          <div style={{ marginBottom: 2 }}>
            <b>- Lực lượng:</b> <span>{AGENCY_LABEL[station?.agency] || MISSING}</span>
            {station?.level && (
              <span style={{ color: '#94a3b8' }}> · {LEVEL_LABEL[station.level] || station.level}</span>
            )}
          </div>
          <div style={{ marginBottom: 2 }}>
            <b>- Loại cơ sở:</b> <span>{station?.facilityType || 'Trụ sở chính'}</span>
          </div>
          <div style={{ marginBottom: 2 }}>
            <b>- Địa bàn:</b>{' '}
            <span>{[station?.ward, station?.province].filter(Boolean).join(', ') || MISSING}</span>
          </div>
          {typeof station?.lat === 'number' && typeof station?.lng === 'number' && (
            <div>
              <b>- Toạ độ:</b>{' '}
              <span style={{ color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>
                {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        {facilities.length > 1 && (
          <div
            style={{
              marginTop: 6,
              marginBottom: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.14)',
              paddingTop: 6,
              maxHeight: 185,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: '#38bdf8',
                textTransform: 'uppercase',
                marginBottom: 5,
              }}
            >
              🏛️ Toàn bộ cơ sở tại {selection.wardName} ({facilities.length} cơ sở)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {facilities.map((fac, idx) => {
                const isNearest = idx === 0;
                // the highlight follows the facility shown above (the one clicked), not the first in the list
                const isActive = station ? fac.id === station.id : isNearest;
                const dist = typeof fac.distanceKm === 'number' ? `${fac.distanceKm.toFixed(2)} km` : '';
                return (
                  <div
                    key={fac.id}
                    onClick={() => pick(fac)}
                    style={{
                      background: isActive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${isActive ? '#10b981' : 'rgba(255, 255, 255, 0.12)'}`,
                      borderRadius: 6,
                      padding: '5px 7px',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 4,
                        flexWrap: 'wrap',
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{ fontSize: 11, fontWeight: 800, color: isActive ? '#34d399' : '#f8fafc' }}
                      >
                        {fac.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            background: 'rgba(56, 189, 248, 0.18)',
                            color: '#7dd3fc',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}
                        >
                          {fac.facilityType || (idx === 0 ? 'Trụ sở chính' : `Cơ sở ${idx + 1}`)}
                        </span>
                        {isNearest && origin ? (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              background: '#10b981',
                              color: '#052e16',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            [Cơ sở gần nhất{dist ? ` · ${dist}` : ''}]
                          </span>
                        ) : (
                          dist && (
                            <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>
                              Cách {dist}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#cbd5e1', lineHeight: 1.3 }}>
                      📍 {fac.address || MISSING}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#22c55e', fontWeight: 700, marginTop: 1 }}>
                      📞 {fac.phone || MISSING}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <a
            href={gmapsUrl(station, origin)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              background: '#c2410c',
              color: '#ffffff',
              padding: '7px 0',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(194, 65, 12, 0.45)',
            }}
          >
            Chỉ đường
          </a>
        </div>

        <div style={{ marginTop: 7, borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 5 }}>
          <details style={{ fontSize: 10.5, color: '#94a3b8', cursor: 'pointer' }}>
            <summary style={{ color: '#fbbf24', fontWeight: 700, outline: 'none' }}>
              THÔNG TIN ĐỊA BÀN (Xem thêm)
            </summary>
            <div style={{ marginTop: 4, lineHeight: 1.45, color: '#cbd5e1', paddingLeft: 6 }}>
              {isProvince ? (
                <>
                  <div style={{ color: '#60a5fa', marginBottom: 2 }}>
                    <b>Địa bàn:</b>{' '}
                    <span style={{ color: '#e2e8f0' }}>Toàn {provinceTitle(selection.provinceName)}</span>
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    - <b>Trụ sở:</b>{' '}
                    <span style={{ color: '#f8fafc', fontWeight: 700 }}>{station?.address || MISSING}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: '#60a5fa', marginBottom: 2 }}>
                    <b>Sáp nhập từ:</b>{' '}
                    <span style={{ color: '#e2e8f0' }}>{selection.sapNhapTu || MISSING}</span>
                  </div>
                  <div style={{ color: '#cbd5e1', marginBottom: 2 }}>
                    - <b>Đơn vị hành chính:</b>{' '}
                    <span style={{ color: '#f8fafc', fontWeight: 700 }}>
                      {selection.wardName}, {selection.provinceName}
                    </span>
                  </div>
                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: 9.5,
                      fontStyle: 'italic',
                      borderTop: '1px dashed rgba(255,255,255,0.1)',
                      paddingTop: 3,
                      marginTop: 3,
                    }}
                  >
                    <b>Diện tích, dân số, mã ĐVHC:</b> {MISSING}
                  </div>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
