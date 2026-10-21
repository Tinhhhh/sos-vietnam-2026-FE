import { useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { Map } from '@/lib/maplibre';

import styles from './location-picker.module.css';

const VIETNAM_VIEW = { center: [106.2, 16.0], zoom: 4.8 };

// Same raster base map as the command map (Vietnamese labels)
const STYLE = {
  version: 8,
  sources: {
    base: {
      type: 'raster',
      tiles: [0, 1, 2, 3].map((n) => `https://mt${n}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}`),
      tileSize: 256,
      attribution: '© Google',
    },
  },
  layers: [{ id: 'base', type: 'raster', source: 'base' }],
};

const MIN_ZOOM = 15; // closer than this the centre point is too rough to send

/**
 * Citizen (or officer) picks a position on a map when GPS / IP location is unavailable or wrong.
 * The pin stays fixed in the middle; move / zoom the map until the pin points at the spot,
 * then "Dùng vị trí này" sends the map centre.
 *
 * @param {{ open: boolean, initial?: { lat: number, lng: number } | null, title?: string,
 *           onPick: (coords: { lat: number, lng: number }) => void, onClose: () => void }} props
 */
export function LocationPicker({ open, initial, title = '🗺️ Chọn vị trí của bạn', onPick, onClose }) {
  const containerRef = useRef(null);
  const [view, setView] = useState(() => ({
    center: initial || { lat: VIETNAM_VIEW.center[1], lng: VIETNAM_VIEW.center[0] },
    zoom: initial ? 16 : VIETNAM_VIEW.zoom,
  }));
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!open || !containerRef.current) return undefined;
    const map = new Map({
      container: containerRef.current,
      style: STYLE,
      center: initial ? [initial.lng, initial.lat] : VIETNAM_VIEW.center,
      zoom: initial ? 16 : VIETNAM_VIEW.zoom,
      attributionControl: { compact: true },
    });
    const sync = () => {
      const c = map.getCenter();
      setView({ center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom() });
    };
    map.on('movestart', () => setMoving(true));
    map.on('moveend', () => {
      setMoving(false);
      sync();
    });
    map.on('move', sync);
    map.once('load', sync); // the view of this opening (the state may be from the last one)
    // Tapping a spot brings it under the pin
    map.on('click', (e) =>
      map.easeTo({ center: e.lngLat, zoom: Math.max(map.getZoom(), MIN_ZOOM), duration: 400 }),
    );
    // The modal animates in: size the canvas once it has its final size
    const t = setTimeout(() => map.resize(), 400);

    return () => {
      clearTimeout(t);
      map.remove();
    };
    // initial is read once per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closeEnough = view.zoom >= MIN_ZOOM;

  return (
    <Modal
      open={open}
      onClose={onClose}
      solid
      containerStyle={{ maxWidth: 720 }}
      title={<span className={styles.title}>{title}</span>}
    >
      <p className={styles.hint}>
        Kéo bản đồ để <b>ghim đỏ ở giữa</b> chỉ đúng vị trí (chạm vào một điểm để đưa điểm đó vào giữa). Phóng
        to để chọn chính xác hơn.
      </p>
      <div className={styles.mapWrap}>
        <div ref={containerRef} className={styles.map} />
        <div className={`${styles.pin} ${moving ? styles.pinLifted : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 34" width="34" height="48">
            <path
              d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 34 12 34s12-13.2 12-22.1C24 5.3 18.6 0 12 0z"
              fill="#ef4444"
              stroke="#fff"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="12" r="4.5" fill="#fff" />
          </svg>
        </div>
        <span className={styles.pinShadow} aria-hidden="true" />
      </div>
      <div className={styles.footer}>
        <span className={styles.coords}>
          {closeEnough
            ? `Toạ độ: ${view.center.lat.toFixed(5)}, ${view.center.lng.toFixed(5)}`
            : 'Phóng to bản đồ thêm để chọn vị trí'}
        </span>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Huỷ
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!closeEnough || moving}
            onClick={() => onPick(view.center)}
          >
            Dùng vị trí này
          </button>
        </div>
      </div>
    </Modal>
  );
}
