import styles from './location-banner.module.css';
import badgeStyles from './jurisdiction-badge.module.css';

function coordsText({ status, coords, accuracy }) {
  if (status === 'locating') return 'Độ chính xác: Đang dò tìm vệ tinh';
  const base = `Tọa độ: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
  if (status === 'fallback') return `${base} (vị trí mặc định — chưa lấy được GPS)`;
  return `${base} (±${accuracy}m)`;
}

/**
 * "VỊ TRÍ GPS VỆ TINH CỦA BẠN" glass banner.
 * @param {{ geo: ReturnType<import('../hooks/use-geolocation').useGeolocation>, networkLabel: string }} props
 */
export function LocationBanner({ geo, networkLabel }) {
  const isLocating = geo.status === 'locating';

  return (
    <div className={`${styles.locationBanner} liquid-glass`}>
      <div className={styles.locInfo}>
        <div className={styles.locIconPulse}>
          <svg className="svg-ico ico-lg ico-red" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div className={styles.locTexts}>
          <div className={styles.locLabel}>VỊ TRÍ GPS VỆ TINH CỦA BẠN</div>
          <div className={styles.locAddress}>
            {isLocating ? (
              'Đang định vị GPS vệ tinh...'
            ) : geo.jurisdiction ? (
              <>
                <span>📍</span> {geo.address}{' '}
                <span className={badgeStyles.badge}>🛡️ Thuộc địa bàn: {geo.jurisdiction.label}</span>
              </>
            ) : (
              geo.address
            )}
          </div>
          <div className={styles.locCoords}>{coordsText(geo)}</div>
          <div className={styles.locNetwork} role="status" aria-live="polite" title={networkLabel}>
            <svg className="svg-ico ico-sm" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 20v-3M10 20v-6M15 20v-10M20 20V2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span>Mạng hiện tại: {networkLabel}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="btn-refresh-loc liquid-glass"
        title="Làm mới vị trí GPS"
        onClick={geo.refresh}
      >
        <svg className="svg-ico ico-sm" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
        Làm mới
      </button>
    </div>
  );
}
