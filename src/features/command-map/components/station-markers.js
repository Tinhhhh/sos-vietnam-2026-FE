import { Marker } from '@/lib/maplibre';

import styles from './map-view.module.css';

const OTHER_AGENCY_PIN = {
  hospital: { icon: '🏥', color: styles.green },
  csgt: { icon: '🚓', color: styles.blue },
  fire: { icon: '🚒', color: styles.orange },
};

/** Legacy map-controller.js createStationMarker(): CAND emblem for police, coloured core for the rest. */
function createPinElement(station) {
  const el = document.createElement('div');
  if (station.agency === 'police') {
    el.className = `${styles.customMapPin} ${styles.conganStationPin} ${styles.permanentStation}`;
    const wrap = document.createElement('div');
    wrap.className = styles.conganPinEmblemWrap;
    const img = document.createElement('img');
    img.src = '/assets/iconcongan.png';
    img.width = 32;
    img.height = 32;
    img.alt = 'Huy hiệu CAND';
    img.className = styles.conganPinEmblem;
    wrap.appendChild(img);
    const label = document.createElement('div');
    label.className = styles.conganPinLabel;
    label.textContent = station.name;
    el.append(wrap, label);
  } else {
    const look = OTHER_AGENCY_PIN[station.agency] || OTHER_AGENCY_PIN.fire;
    el.className = `${styles.customMapPin} ${styles.stationPin} ${styles.permanentStation}`;
    const core = document.createElement('div');
    core.className = `${styles.pinCore} ${look.color}`;
    core.textContent = look.icon;
    const tip = document.createElement('div');
    tip.className = styles.pinTooltip;
    tip.textContent = station.name;
    el.append(core, tip);
  }
  return el;
}

/** Legacy "dispatcher-gps-marker": radar pulse + pin + badge with the ward name. */
export function createGpsBeacon(map, { lat, lng }, label) {
  const el = document.createElement('div');
  el.className = styles.dispatcherGpsMarker;
  const radar = document.createElement('div');
  radar.className = styles.gpsBeaconRadar;
  const center = document.createElement('div');
  center.className = styles.gpsBeaconCenter;
  center.textContent = '📍';
  const badge = document.createElement('div');
  badge.className = styles.gpsBeaconBadge;
  badge.textContent = label;
  el.append(radar, center, badge);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    map.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
  });
  return new Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
}

/**
 * Keeps one MapLibre marker per visible station: mounts new ones, removes the
 * ones that left the view (legacy viewport culling).
 */
export class StationMarkers {
  constructor(map, onClick) {
    this.map = map;
    this.onClick = onClick;
    this.markers = new Map(); // id -> { marker, el }
    this.selectedId = null;
  }

  sync(visibleStations) {
    const keep = new Set(visibleStations.map((s) => s.id));
    for (const [id, entry] of this.markers) {
      if (!keep.has(id)) {
        entry.marker.remove();
        this.markers.delete(id);
      }
    }
    for (const st of visibleStations) {
      if (this.markers.has(st.id)) continue;
      const el = createPinElement(st);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onClick(st);
      });
      if (st.id === this.selectedId) el.classList.add(styles.neonSelected);
      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([st.lng, st.lat])
        .addTo(this.map);
      this.markers.set(st.id, { marker, el });
    }
  }

  select(id) {
    if (this.selectedId && this.markers.has(this.selectedId)) {
      this.markers.get(this.selectedId).el.classList.remove(styles.neonSelected);
    }
    this.selectedId = id;
    if (id && this.markers.has(id)) this.markers.get(id).el.classList.add(styles.neonSelected);
  }

  clear() {
    for (const { marker } of this.markers.values()) marker.remove();
    this.markers.clear();
  }
}
