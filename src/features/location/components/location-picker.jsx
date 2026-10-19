import { useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { Map, Marker } from '@/lib/maplibre';

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

/**
 * Citizen picks their position on a map when GPS / IP location is unavailable or wrong.
 * Tap the map (or drag the pin) then "Dùng vị trí này".
 *
 * @param {{ open: boolean, initial?: { lat: number, lng: number } | null,
 *           onPick: (coords: { lat: number, lng: number }) => void, onClose: () => void }} props
 */
export function LocationPicker({ open, initial, onPick, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [picked, setPicked] = useState(initial || null);

  useEffect(() => {
    if (!open || !containerRef.current) return undefined;
    const map = new Map({
      container: containerRef.current,
      style: STYLE,
      center: initial ? [initial.lng, initial.lat] : VIETNAM_VIEW.center,
      zoom: initial ? 15 : VIETNAM_VIEW.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const place = (lngLat) => {
      if (!markerRef.current) {
        markerRef.current = new Marker({ color: '#ef4444', draggable: true }).setLngLat(lngLat).addTo(map);
        markerRef.current.on('dragend', () => {
          const p = markerRef.current.getLngLat();
          setPicked({ lat: p.lat, lng: p.lng });
        });
      } else {
        markerRef.current.setLngLat(lngLat);
      }
      setPicked({ lat: lngLat.lat ?? lngLat[1], lng: lngLat.lng ?? lngLat[0] });
    };
    if (initial) place([initial.lng, initial.lat]);
    map.on('click', (e) => place(e.lngLat));
    // The modal animates in: size the canvas once it has its final size
    const t = setTimeout(() => map.resize(), 400);

    return () => {
      clearTimeout(t);
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    // initial is read once per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      solid
      containerStyle={{ maxWidth: 720 }}
      title={<span className={styles.title}>🗺️ Chọn vị trí của bạn</span>}
    >
      <p className={styles.hint}>
        Chạm vào bản đồ đúng chỗ bạn đang đứng (có thể kéo ghim đỏ để chỉnh). Phóng to để đặt ghim chính xác
        hơn.
      </p>
      <div ref={containerRef} className={styles.map} />
      <div className={styles.footer}>
        <span className={styles.coords}>
          {picked ? `Toạ độ: ${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}` : 'Chưa chọn vị trí'}
        </span>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Huỷ
          </button>
          <button type="button" className={styles.primary} disabled={!picked} onClick={() => onPick(picked)}>
            Dùng vị trí này
          </button>
        </div>
      </div>
    </Modal>
  );
}
