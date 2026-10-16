/**
 * MapLibre style for the command map (port of legacy map-controller.js init()).
 * Only the "Bản Đồ Nền VN (Chuẩn 2026)" base layer is kept; satellite and night
 * tactical styles were dropped on purpose.
 */
export const GEO_URLS = {
  provinces: '/assets/geo/vn-provinces.geojson',
  provinceLabels: '/assets/geo/vn-province-labels.geojson',
};

export const EMPTY_FC = { type: 'FeatureCollection', features: [] };

// Zoom thresholds from legacy updateVisibleStationPins()
export const STATIONS_MIN_ZOOM = 5.8; // below: no station pins at all
export const WARD_DETAIL_ZOOM = 8.5; // from here: ward stations + ward grid of the focus province

export const NATIONAL_VIEW = { center: [107.0, 16.2], zoom: 5.2, mobileZoom: 4.85 };

export const LAYERS = {
  provinces: ['vn-provinces-shadow', 'vn-provinces-boundary', 'vn-province-labels'],
  wards: ['vn-focus-wards-fill', 'vn-focus-wards-line'],
  provinceHighlight: [
    'vn-province-highlight-fill',
    'vn-province-highlight-glow',
    'vn-province-highlight-line',
  ],
  wardHighlight: ['ward-boundary-fill', 'ward-boundary-glow', 'ward-boundary-line'],
};

export function buildBaseStyle({ wardsVisible, provincesVisible }) {
  const vis = (on) => (on ? 'visible' : 'none');
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'vn-narenca': {
        type: 'raster',
        tiles: [0, 1, 2, 3].map((n) => `https://mt${n}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}`),
        tileSize: 256,
        attribution: '&copy; Bản Đồ Nền Quốc Gia 2026',
      },
      vnprov: { type: 'geojson', data: GEO_URLS.provinces },
      vnlbl: { type: 'geojson', data: GEO_URLS.provinceLabels },
      'vn-focus-wards': { type: 'geojson', data: EMPTY_FC },
      'ward-boundary': { type: 'geojson', data: EMPTY_FC },
    },
    layers: [
      { id: 'base-tiles', type: 'raster', source: 'vn-narenca', minzoom: 0, maxzoom: 20 },
      {
        id: 'vn-provinces-shadow',
        type: 'line',
        source: 'vnprov',
        layout: { visibility: vis(provincesVisible) },
        paint: {
          'line-color': 'rgba(0,0,0,0.7)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 6],
          'line-blur': 2,
        },
      },
      {
        id: 'vn-provinces-boundary',
        type: 'line',
        source: 'vnprov',
        layout: { visibility: vis(provincesVisible) },
        paint: {
          'line-color': '#00d2ff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 10, 2.5],
          'line-opacity': 0.75,
        },
      },
      {
        id: 'vn-province-labels',
        type: 'symbol',
        source: 'vnlbl',
        minzoom: 4,
        maxzoom: 11,
        layout: {
          visibility: vis(provincesVisible),
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 14],
          'text-transform': 'uppercase',
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 2 },
      },
      {
        id: 'vn-focus-wards-fill',
        type: 'fill',
        source: 'vn-focus-wards',
        layout: { visibility: vis(wardsVisible) },
        paint: { 'fill-color': '#fde047', 'fill-opacity': 0.04 },
      },
      {
        id: 'vn-focus-wards-line',
        type: 'line',
        source: 'vn-focus-wards',
        layout: { visibility: vis(wardsVisible) },
        paint: {
          'line-color': '#facc15',
          // Legacy values; the 'all' scope also shows the grid at country zoom
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 8, 0.9, 12, 1.6],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 8, 0.7, 12, 0.9],
        },
      },
      // Selected province (legacy highlightProvinceBoundary)
      {
        id: 'vn-province-highlight-fill',
        type: 'fill',
        source: 'vnprov',
        filter: ['==', ['get', 'shapeName'], ''],
        paint: { 'fill-color': '#eab308', 'fill-opacity': 0.18 },
      },
      {
        id: 'vn-province-highlight-glow',
        type: 'line',
        source: 'vnprov',
        filter: ['==', ['get', 'shapeName'], ''],
        paint: { 'line-color': '#f59e0b', 'line-width': 14, 'line-blur': 8, 'line-opacity': 0.85 },
      },
      {
        id: 'vn-province-highlight-line',
        type: 'line',
        source: 'vnprov',
        filter: ['==', ['get', 'shapeName'], ''],
        paint: { 'line-color': '#fde047', 'line-width': 3.5, 'line-opacity': 1 },
      },
      // Selected ward (legacy highlightWardBoundary): amber glow, purple geofence fill, bright yellow stroke
      {
        id: 'ward-boundary-glow',
        type: 'line',
        source: 'ward-boundary',
        paint: { 'line-color': '#f59e0b', 'line-width': 12, 'line-blur': 6, 'line-opacity': 0.85 },
      },
      {
        id: 'ward-boundary-fill',
        type: 'fill',
        source: 'ward-boundary',
        paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.3 },
      },
      {
        id: 'ward-boundary-line',
        type: 'line',
        source: 'ward-boundary',
        paint: { 'line-color': '#facc15', 'line-width': 3.5, 'line-opacity': 1 },
      },
    ],
  };
}
