import { Marker } from '@/lib/maplibre';

import styles from './map-view.module.css';

/**
 * Red pulsing SOS pins for the incidents in the officer's queue (legacy
 * map-controller.js setCitizenMarker(): pin-ring-pulse + red pin-core + tooltip).
 * Unlike stations, every active incident stays on the map whatever the zoom.
 */
function createIncidentElement(incident) {
  const el = document.createElement('div');
  el.className = `${styles.customMapPin} ${styles.stationPin}`;
  el.style.zIndex = '5';
  const pulse = document.createElement('div');
  pulse.className = styles.pinRingPulse;
  const core = document.createElement('div');
  core.className = `${styles.pinCore} ${styles.red}`;
  core.textContent = '🆘';
  const tip = document.createElement('div');
  tip.className = styles.pinTooltip;
  tip.textContent = `${incident.id} · ${incident.tags.join(', ') || 'SOS'}`;
  el.append(pulse, core, tip);
  return el;
}

export class IncidentMarkers {
  constructor(map, onClick) {
    this.map = map;
    this.onClick = onClick;
    this.markers = new Map(); // id -> { marker, el }
    this.selectedId = null;
  }

  sync(incidents) {
    const withCoords = incidents.filter((i) => i.lat != null && i.lng != null);
    const keep = new Set(withCoords.map((i) => i.id));
    for (const [id, entry] of this.markers) {
      if (!keep.has(id)) {
        entry.marker.remove();
        this.markers.delete(id);
      }
    }
    for (const inc of withCoords) {
      const existing = this.markers.get(inc.id);
      if (existing) {
        existing.marker.setLngLat([inc.lng, inc.lat]);
        continue;
      }
      const el = createIncidentElement(inc);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onClick(inc);
      });
      if (inc.id === this.selectedId) el.classList.add(styles.neonSelected);
      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([inc.lng, inc.lat])
        .addTo(this.map);
      this.markers.set(inc.id, { marker, el });
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
