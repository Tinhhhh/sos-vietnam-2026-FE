// Map Controller with CartoDB Dark, Esri Satellite, Google Maps & 34 Provinces System

export class MapController {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = options;
    this.map = null;
    this.markers = new Map();
    this.routeSourceId = 'rescue-route';
    this.vehicleMarker = null;
    this.stationMarkers = [];
    this.activeWardStationMarker = null;
    this.currentStyleMode = 'dark'; // 'dark' | 'satellite' | 'streets'
    // Mặc định bật sẵn Lưới 3.321 Xã/Phường theo yêu cầu trực ban (người dùng có thể tự tắt)
    if (localStorage.getItem('sos_wards_default_v2') !== 'true') {
      this.allWardsVisible = true;
      localStorage.setItem('allWardsVisible', 'true');
      localStorage.setItem('sos_wards_default_v2', 'true');
    } else {
      const savedWards = localStorage.getItem('allWardsVisible');
      this.allWardsVisible = savedWards === null ? true : (savedWards === 'true');
    }
    this.activeStationMarkersMap = new Map();
    this.candidateStations = [];
    this.stationsVisible = true;
    this._viewportCullingBound = false;
  }

  init(center = [105.8542, 21.0285], zoom = 14) {
    if (!window.maplibregl) {
      console.error('MapLibre GL not loaded');
      return;
    }

    const defaultStyle = {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        'vn-narenca': {
          type: 'raster',
          tiles: [
            'https://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}'
          ],
          tileSize: 256,
          attribution: '&copy; Bản Đồ Nền Quốc Gia 2026'
        },
        'esri-sat': {
          type: 'raster',
          tiles: [
            'https://mt0.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}'
          ],
          tileSize: 256,
          attribution: '&copy; Ảnh Vệ Tinh Độ Nét Cao'
        },
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}'
          ],
          tileSize: 256,
          maxzoom: 21,
          attribution: '&copy; Bản Đồ Tác Chiến Chỉ Huy Quân Sự'
        },
        vnprov: {
          type: 'geojson',
          data: '/assets/vn-provinces.geojson'
        },
        vnlbl: {
          type: 'geojson',
          data: '/assets/vn-province-labels.geojson'
        },
        'vn-all-wards': {
          type: 'geojson',
          data: '/assets/vn-wards-simplified.geojson'
        }
      },
      layers: [
        {
          id: 'base-tiles',
          type: 'raster',
          source: 'vn-narenca',
          minzoom: 0,
          maxzoom: 20
        },
        {
          id: 'vn-provinces-shadow',
          type: 'line',
          source: 'vnprov',
          paint: {
            'line-color': 'rgba(0,0,0,0.7)',
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 6],
            'line-blur': 2
          }
        },
        {
          id: 'vn-provinces-boundary',
          type: 'line',
          source: 'vnprov',
          paint: {
            'line-color': '#00d2ff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 10, 2.5],
            'line-opacity': 0.75
          }
        },
        {
          id: 'vn-province-labels',
          type: 'symbol',
          source: 'vnlbl',
          minzoom: 4,
          maxzoom: 11,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 14],
            'text-transform': 'uppercase'
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.85)',
            'text-halo-width': 2
          }
        },
        {
          id: 'vn-all-wards-fill',
          type: 'fill',
          source: 'vn-all-wards',
          layout: {
            visibility: this.allWardsVisible ? 'visible' : 'none'
          },
          paint: {
            'fill-color': '#fde047',
            'fill-opacity': 0.04
          }
        },
        {
          id: 'vn-all-wards-line',
          type: 'line',
          source: 'vn-all-wards',
          layout: {
            visibility: this.allWardsVisible ? 'visible' : 'none'
          },
          paint: {
            'line-color': '#facc15',
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 8, 0.9, 12, 1.6],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 8, 0.7, 12, 0.9]
          }
        }
      ]
    };

    this.map = new window.maplibregl.Map({
      container: this.containerId,
      style: defaultStyle,
      center: center,
      zoom: zoom,
      pitch: 25,
      attributionControl: false
    });

    // Bảo vệ: bỏ qua yêu cầu thêm lớp đã tồn tại (tránh lỗi "Layer ... already exists")
    const mapRef = this.map;
    const originalAddLayer = mapRef.addLayer.bind(mapRef);
    mapRef.addLayer = (layer, before) => {
      try {
        if (layer && layer.id && mapRef.getLayer(layer.id)) return mapRef;
        return originalAddLayer(layer, before);
      } catch (err) {
        console.warn('[map] Không thêm được lớp:', layer && layer.id, err && err.message);
        return mapRef;
      }
    };
    const originalAddSource = mapRef.addSource.bind(mapRef);
    mapRef.addSource = (id, source) => {
      try {
        if (id && mapRef.getSource(id)) return mapRef;
        return originalAddSource(id, source);
      } catch (err) {
        console.warn('[map] Không thêm được nguồn:', id, err && err.message);
        return mapRef;
      }
    };

    if (!this.options.disableStations) {
      this.loadAllStationsMarkers();
    }
    return this.map;
  }

  switchTileLayer(sourceId) {
    if (!this.map) return;

    const sourceDefs = {
      'vn-narenca': {
        type: 'raster',
        tiles: [
          'https://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
          'https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
          'https://mt2.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
          'https://mt3.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}'
        ],
        tileSize: 256
      },
      'esri-sat': {
        type: 'raster',
        tiles: [
          'https://mt0.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}',
          'https://mt1.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}',
          'https://mt2.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}',
          'https://mt3.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}'
        ],
        tileSize: 256
      },
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
          'https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
          'https://mt2.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
          'https://mt3.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}'
        ],
        tileSize: 256,
        maxzoom: 21
      }
    };

    let actualSource = sourceId;
    if (sourceId === 'carto-dark' || sourceId === 'tactical-dark') {
      actualSource = 'carto-dark';
    }

    // Ensure source exists in map
    if (!this.map.getSource(actualSource) && sourceDefs[actualSource]) {
      this.map.addSource(actualSource, sourceDefs[actualSource]);
    }

    if (this.map.getLayer('base-tiles')) {
      this.map.removeLayer('base-tiles');
    }

    const container = this.map.getContainer();
    if (actualSource === 'carto-dark') {
      if (container) container.classList.add('tactical-dark-mode');
    } else {
      if (container) container.classList.remove('tactical-dark-mode');
    }

    // Insert base-tiles before lowest vector layer
    const beforeLayerId = this.map.getLayer('vn-provinces-shadow') ? 'vn-provinces-shadow' : undefined;
    this.map.addLayer(
      {
        id: 'base-tiles',
        type: 'raster',
        source: actualSource,
        minzoom: 0,
        maxzoom: 20
      },
      beforeLayerId
    );

    // Re-order top layers
    const topLayers = [
      'vn-provinces-shadow',
      'vn-provinces-boundary',
      'vn-province-labels',
      'vn-all-wards-fill',
      'vn-all-wards-line',
      'vn-province-highlight-fill',
      'vn-province-highlight-glow',
      'vn-province-highlight-line',
      'ward-boundary-glow',
      'ward-boundary-line',
      'ward-boundary-fill'
    ];
    topLayers.forEach(l => {
      if (this.map.getLayer(l)) this.map.moveLayer(l);
    });
  }



  toggleProvinceBoundaries(visible) {
    if (!this.map) return;
    const layers = ['vn-provinces-shadow', 'vn-provinces-boundary', 'vn-province-labels'];
    layers.forEach(id => {
      if (this.map.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    });
    this.provinceBoundariesVisible = Boolean(visible);
  }

  highlightProvinceBoundary(provinceName) {
    if (!this.map) return;
    const layerIdGlow = 'vn-province-highlight-glow';
    const layerIdLine = 'vn-province-highlight-line';
    const layerIdFill = 'vn-province-highlight-fill';

    // Clear highlight if empty
    if (!provinceName) {
      if (this.map.getLayer(layerIdGlow)) this.map.removeLayer(layerIdGlow);
      if (this.map.getLayer(layerIdLine)) this.map.removeLayer(layerIdLine);
      if (this.map.getLayer(layerIdFill)) this.map.removeLayer(layerIdFill);
      return;
    }

    if (!this.map.getSource('vnprov')) return;

    // Matches shapeName or name or name_en in vn-provinces.geojson
    const cleanName = provinceName.trim();
    const shortName = cleanName.replace(/^TP\.\s*/i, '').trim();

    const filter = [
      'any',
      ['==', ['get', 'shapeName'], cleanName],
      ['==', ['get', 'name'], cleanName],
      ['==', ['get', 'shapeName'], shortName],
      ['==', ['get', 'name'], shortName],
      ['==', ['get', 'name_en'], cleanName]
    ];

    // 1. Semi-transparent glowing yellow fill
    if (!this.map.getLayer(layerIdFill)) {
      this.map.addLayer({
        id: layerIdFill,
        type: 'fill',
        source: 'vnprov',
        paint: {
          'fill-color': '#eab308',
          'fill-opacity': 0.18
        },
        filter: filter
      });
    } else {
      this.map.setFilter(layerIdFill, filter);
    }

    // 2. High-Tech Luminous Outer Glow (sapnhap.bando.com.vn Yellow Outline)
    if (!this.map.getLayer(layerIdGlow)) {
      this.map.addLayer({
        id: layerIdGlow,
        type: 'line',
        source: 'vnprov',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 14,
          'line-blur': 8,
          'line-opacity': 0.85
        },
        filter: filter
      });
    } else {
      this.map.setFilter(layerIdGlow, filter);
    }

    // 3. Crisp Bright Yellow Boundary Stroke
    if (!this.map.getLayer(layerIdLine)) {
      this.map.addLayer({
        id: layerIdLine,
        type: 'line',
        source: 'vnprov',
        paint: {
          'line-color': '#fde047',
          'line-width': 3.5,
          'line-opacity': 1.0
        },
        filter: filter
      });
    } else {
      this.map.setFilter(layerIdLine, filter);
    }
  }



  clearWardBoundary() {
    if (!this.map) return;
    const layers = ['ward-boundary-fill', 'ward-boundary-glow', 'ward-boundary-line'];
    layers.forEach(id => {
      if (this.map.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', 'none');
      }
    });
  }

  toggleWardBoundaryVisibility(visible) {
    if (!this.map) return false;
    const layers = ['ward-boundary-glow', 'ward-boundary-line', 'ward-boundary-fill'];
    const anyLayer = this.map.getLayer('ward-boundary-line');
    if (!anyLayer) return false;

    const currentVis = this.map.getLayoutProperty('ward-boundary-line', 'visibility') !== 'none';
    const newVis = visible !== undefined ? Boolean(visible) : !currentVis;

    layers.forEach(id => {
      if (this.map.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', newVis ? 'visible' : 'none');
      }
    });
    return newVis;
  }

  toggleStationsLayer(visible) {
    this.stationsVisible = Boolean(visible);
    if (!this.stationsVisible) {
      this.clearStationMarkers();
    } else {
      this.updateVisibleStationPins();
    }
  }

  async toggleAllWardsLayer(visible) {
    if (!this.map) return;
    this.allWardsVisible = Boolean(visible);
    localStorage.setItem('allWardsVisible', String(this.allWardsVisible));

    const sourceId = 'vn-all-wards-source';
    const layers = [
      { id: 'vn-all-wards-fill', type: 'fill', paint: { 'fill-color': '#0284c7', 'fill-opacity': 0.05 } },
      { id: 'vn-all-wards-glow', type: 'line', paint: { 'line-color': '#38bdf8', 'line-width': 3, 'line-opacity': 0.4, 'line-blur': 2 } },
      { id: 'vn-all-wards-line', type: 'line', paint: { 'line-color': '#facc15', 'line-width': 1.2, 'line-opacity': 0.8 } }
    ];

    if (!this.map.getSource(sourceId)) {
      if (!visible) return;
      try {
        const res = await fetch('/assets/vn-ward-boundaries.json');
        const data = await res.json();
        if (!this.map.getSource(sourceId)) {
          this.map.addSource(sourceId, {
            type: 'geojson',
            data: data
          });

          layers.forEach(l => {
            if (!this.map.getLayer(l.id)) {
              this.map.addLayer({
                id: l.id,
                type: l.type,
                source: sourceId,
                paint: l.paint,
                layout: { visibility: 'visible' }
              });
            }
          });
        }
      } catch (err) {
        console.error('Error loading all-wards boundary data:', err);
      }
    } else {
      layers.forEach(l => {
        if (this.map.getLayer(l.id)) {
          this.map.setLayoutProperty(l.id, 'visibility', visible ? 'visible' : 'none');
        }
      });
    }
  }



  setCitizenMarker(lat, lng, label = 'Vị trí của bạn', shouldFly = false) {
    if (!this.map) return;
    if (this.markers.has('citizen')) {
      this.markers.get('citizen').remove();
    }

    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      this.citizenCoords = { lat: Number(lat), lng: Number(lng) };
    }

    const el = document.createElement('div');
    el.className = 'custom-map-pin citizen-pin';
    el.innerHTML = `
      <div class="pin-ring-pulse"></div>
      <div class="pin-core red">
        <span>📍</span>
      </div>
      <div class="pin-tooltip">${label}</div>
    `;

    const marker = new window.maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(this.map);

    this.markers.set('citizen', marker);
    if (shouldFly) {
      this.map.flyTo({ center: [lng, lat], zoom: 15.5, duration: 1200 });
    }
  }

  clearCitizenMarker() {
    if (this.markers && this.markers.has('citizen')) {
      try { this.markers.get('citizen').remove(); } catch (e) {}
      this.markers.delete('citizen');
    }
    this.citizenCoords = null;
  }

  clearVehicleMarker() {
    if (this.markers && this.markers.has('vehicle')) {
      try { this.markers.get('vehicle').remove(); } catch (e) {}
      this.markers.delete('vehicle');
    }
  }

  setStationMarker(lat, lng, name, agency) {
    if (!this.map) return;
    if (this.markers.has('station')) {
      this.markers.get('station').remove();
    }

    const icon = agency === 'police' ? '👮‍♂️' : (agency === 'hospital' ? '🚑' : '🚒');
    const colorClass = agency === 'police' ? 'blue' : (agency === 'hospital' ? 'green' : 'orange');

    const el = document.createElement('div');
    el.className = `custom-map-pin station-pin`;
    el.innerHTML = `
      <div class="pin-core ${colorClass}">
        <span>${icon}</span>
      </div>
      <div class="pin-tooltip">${name}</div>
    `;

    const marker = new window.maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(this.map);

    this.markers.set('station', marker);
  }

  setVehicleMarker(lat, lng, agency, unitName) {
    if (!this.map) return;
    const icon = agency === 'police' ? '🚓' : (agency === 'hospital' ? '🚑' : '🚒');

    if (this.markers.has('vehicle')) {
      this.markers.get('vehicle').setLngLat([lng, lat]);
      return;
    }

    const el = document.createElement('div');
    el.className = 'custom-map-pin vehicle-pin';
    el.innerHTML = `
      <div class="pin-ring-pulse vehicle"></div>
      <div class="pin-core vehicle">
        <span>${icon}</span>
      </div>
      <div class="pin-tooltip">${unitName || 'Xe cứu hộ đang tiếp cận'}</div>
    `;

    const marker = new window.maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(this.map);

    this.markers.set('vehicle', marker);
  }

  /**
   * @param {[number, number]} fromCoords
   * @param {[number, number]} toCoords
   * @param {'driving'|'motorbike'} vehicleProfile - which vehicle class is assigned to this
   *   incident. NOTE: the public OSRM demo server (router.project-osrm.org) only exposes a
   *   'driving' routing profile; it has no motorcycle/bike profile at all. So regardless of
   *   vehicleProfile, the street-shape request below always calls OSRM's 'driving' endpoint
   *   (that's the only real path geometry source available). What DOES change with
   *   vehicleProfile is the rendered line's color/dash style, so a motorbike-assigned unit's
   *   route never looks visually identical to a car/ambulance-assigned unit's route.
   */
  async drawRoute(fromCoords, toCoords, vehicleProfile = 'driving') {
    if (!this.map) return;

    const isMotorbike = vehicleProfile === 'motorbike';
    let routeCoordinates = [fromCoords, toCoords];

    // Attempt OSRM real street path (driving profile only - see function doc above)
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromCoords[0]},${fromCoords[1]};${toCoords[0]},${toCoords[1]}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl);
      const data = await res.json();
      if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
        routeCoordinates = data.routes[0].geometry.coordinates;
      }
    } catch (e) {
      console.warn('OSRM fallback to straight line:', e);
    }

    const routeGeoJSON = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates
      }
    };

    const glowId = this.routeSourceId + '-glow';
    const lineId = this.routeSourceId + '-line';

    // Motorbike-assigned units render as green/dashed; car/ambulance/truck-class units
    // keep the original blue/solid style. Honest distinction given OSRM's single profile.
    const glowColor = isMotorbike ? '#10b981' : '#0088ff';
    const lineColor = isMotorbike ? '#34d399' : '#00d2ff';
    const lineDasharray = isMotorbike ? [2, 1.5] : undefined;

    if (this.map.getSource(this.routeSourceId)) {
      this.map.getSource(this.routeSourceId).setData(routeGeoJSON);
      // Layers already exist from a prior call; re-apply paint in case the
      // vehicle profile differs from whatever it was drawn with last time.
      this.map.setPaintProperty(glowId, 'line-color', glowColor);
      this.map.setPaintProperty(lineId, 'line-color', lineColor);
      this.map.setPaintProperty(lineId, 'line-dasharray', lineDasharray || [1, 0]);
    } else {
      this.map.addSource(this.routeSourceId, {
        type: 'geojson',
        data: routeGeoJSON
      });

      // Glow casing line
      this.map.addLayer({
        id: glowId,
        type: 'line',
        source: this.routeSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': glowColor,
          'line-width': 8,
          'line-opacity': 0.45,
          'line-blur': 3
        }
      });

      // Core animated pulse line
      this.map.addLayer({
        id: lineId,
        type: 'line',
        source: this.routeSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': lineColor,
          'line-width': 4,
          ...(lineDasharray ? { 'line-dasharray': lineDasharray } : {})
        }
      });
    }

    // Fit bounds
    const bounds = new window.maplibregl.LngLatBounds();
    routeCoordinates.forEach(c => bounds.extend(c));
    this.map.fitBounds(bounds, { padding: 80, maxZoom: 16 });

    return routeCoordinates;
  }


  removeRoute() {
    if (!this.map) return;
    try {
      if (this.map.getLayer(this.routeSourceId + '-line')) this.map.removeLayer(this.routeSourceId + '-line');
      if (this.map.getLayer(this.routeSourceId + '-glow')) this.map.removeLayer(this.routeSourceId + '-glow');
      if (this.map.getSource(this.routeSourceId)) this.map.removeSource(this.routeSourceId);
    } catch (e) {}
  }

  clearIncidentMarkers() {
    if (this.markers) {
      this.markers.forEach(m => { try { m.remove(); } catch(e) {} });
      this.markers.clear();
    }
    this.citizenCoords = null;
    this.removeRoute();
  }

  clearActiveWardPin() {
    if (this.activeWardStationMarker) {
      try { this.activeWardStationMarker.remove(); } catch(e) {}
      this.activeWardStationMarker = null;
    }
    if (this.activeWardAuxiliaryMarkers && Array.isArray(this.activeWardAuxiliaryMarkers)) {
      this.activeWardAuxiliaryMarkers.forEach(m => { try { m.remove(); } catch(e) {} });
      this.activeWardAuxiliaryMarkers = [];
    }
    try {
      document.querySelectorAll('.cantho-official-station-popup').forEach(el => el.remove());
    } catch (_) {}
    this.activeWardStationId = null;
    this.activeWardCoords = null;
    this.activeWardAllStationIds = null;
  }

  resolveCitizenReferenceCoords(cleanWard = '', cleanProv = '') {
    const isValidCoord = (lat, lng) => {
      const nLat = Number(lat);
      const nLng = Number(lng);
      return Number.isFinite(nLat) && Number.isFinite(nLng) && Math.abs(nLat) > 0.1 && Math.abs(nLng) > 0.1;
    };

    const disp = window.dispatcher || window.dispatcherApp;

    // 1. Current live GPS of the device running dispatcher
    if (disp?.currentGps && isValidCoord(disp.currentGps.lat, disp.currentGps.lng)) {
      return { lat: Number(disp.currentGps.lat), lng: Number(disp.currentGps.lng) };
    }
    if (disp?.currentLocation && isValidCoord(disp.currentLocation.lat, disp.currentLocation.lng)) {
      return { lat: Number(disp.currentLocation.lat), lng: Number(disp.currentLocation.lng) };
    }
    try {
      const savedDispGps = localStorage.getItem('sos_dispatcher_current_gps');
      if (savedDispGps) {
        const parsed = JSON.parse(savedDispGps);
        if (parsed && isValidCoord(parsed.lat, parsed.lng)) {
          return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
        }
      }
    } catch (_) {}

    // 2. Citizen app LocationService or saved citizen GPS on this device
    const appCoords = window.app?.locationService?.currentCoords || window.app?.currentLocation || window.app?.citizenCoords;
    if (appCoords && isValidCoord(appCoords.lat, appCoords.lng)) {
      return { lat: Number(appCoords.lat), lng: Number(appCoords.lng) };
    }
    try {
      const savedCitizenGps = localStorage.getItem('sos_citizen_last_gps');
      if (savedCitizenGps) {
        const parsed = JSON.parse(savedCitizenGps);
        if (parsed && isValidCoord(parsed.lat, parsed.lng)) {
          return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
        }
      }
    } catch (_) {}

    // 3. Device / user coordinates on MapController
    const mcUser = this.userLocation || this.currentGps || this.citizenCoords;
    if (mcUser && isValidCoord(mcUser.lat, mcUser.lng)) {
      return { lat: Number(mcUser.lat), lng: Number(mcUser.lng) };
    }

    return null;
  }

  showWardStationPin(wardFeature, overrideStation = null) {
    if (!this.map || !wardFeature) return;
    this.clearActiveWardPin();

    const p = wardFeature.properties || {};
    const wardName = (p.ward || p.name || p.ten_xa || p.ten || p.Name || '').trim();
    const provName = (p.province || p.ten_tinh || p.tinh || p.Province || '').trim();

    // Compute polygon centroid / center
    let centerLng = null;
    let centerLat = null;
    if (Array.isArray(p.center) && p.center.length === 2) {
      centerLng = Number(p.center[0]);
      centerLat = Number(p.center[1]);
    } else if (wardFeature.geometry) {
      const geom = wardFeature.geometry;
      let allCoords = [];
      if (geom.type === 'Polygon') {
        allCoords = geom.coordinates[0] || [];
      } else if (geom.type === 'MultiPolygon') {
        (geom.coordinates || []).forEach(poly => {
          if (poly && poly[0]) allCoords.push(...poly[0]);
        });
      }
      if (allCoords.length > 0) {
        const sumLng = allCoords.reduce((acc, c) => acc + c[0], 0);
        const sumLat = allCoords.reduce((acc, c) => acc + c[1], 0);
        centerLng = sumLng / allCoords.length;
        centerLat = sumLat / allCoords.length;
      }
    }

    if (!centerLng || !centerLat) {
      centerLng = 105.783;
      centerLat = 10.033;
    }

    // Lookup station from memory
    let station = overrideStation;
    const rawPool = (Array.isArray(this.stationsData) && this.stationsData.length)
      ? this.stationsData
      : (Array.isArray(this.cachedStations) && this.cachedStations.length)
        ? this.cachedStations
        : (window.dispatcherApp && Array.isArray(window.dispatcherApp.stationsList) && window.dispatcherApp.stationsList.length)
          ? window.dispatcherApp.stationsList
          : [];
    const stationsPool = rawPool.filter(s => !this.isNonOperationalStation(s));
    if ((!this.stationsData || !this.stationsData.length) && stationsPool.length) {
      this.stationsData = stationsPool;
    }
    if (stationsPool.length === 0 && !this._loadingStationsForWardPin) {
      this._loadingStationsForWardPin = true;
      this.getStationsData().then(loaded => {
        this._loadingStationsForWardPin = false;
        if (loaded && loaded.length > 0) {
          this.showWardStationPin(wardFeature, overrideStation);
        }
      }).catch(() => {
        this._loadingStationsForWardPin = false;
      });
    }

    const cleanW = wardName.toLowerCase().replace(/^(phường|xã|thị trấn|p\.|x\.|tt\.)\s*/i, '').trim();
    const cleanP = provName.toLowerCase().replace(/^(tỉnh|thành phố|tp\.)\s*/i, '').trim();
    const citizenRef = this.resolveCitizenReferenceCoords(cleanW, cleanP);

    const calcHaversineKm = (lat1, lng1, lat2, lng2) => {
      if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) return null;
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
    };

    let matchingWardStations = [];
    if (stationsPool.length > 0) {
      const isWardPolice = s => s && !this.isNonOperationalStation(s) && (s.level === 'ward' || !s.level) && (s.agency === 'police' || !s.agency) && (!s.unitCategory || s.unitCategory === 'ward_police') && !s.isRegionalSquad && !s.isCityHq;

      // Find all facilities belonging to this ward
      if (cleanW) {
        matchingWardStations = stationsPool.filter(s => {
          if (!s || s.id === 'st-admin' || s.level === 'national' || !isWardPolice(s)) return false;
          const sProv = (s.province || '').toLowerCase();
          const matchProv = !cleanP || sProv.includes(cleanP) || cleanP.includes(sProv);
          if (!matchProv) return false;
          const sW = (s.ward || s.unit_title || s.name || '').toLowerCase().replace(/^(phường|xã|thị trấn|công an phường|công an xã|p\.|x\.|tt\.)\s*/i, '').trim();
          return sW === cleanW;
        });

        if (!matchingWardStations.length) {
          matchingWardStations = stationsPool.filter(s => {
            if (!s || s.id === 'st-admin' || s.level === 'national' || !isWardPolice(s)) return false;
            const sProv = (s.province || '').toLowerCase();
            const matchProv = !cleanP || sProv.includes(cleanP) || cleanP.includes(sProv);
            if (!matchProv) return false;
            const sW = (s.ward || s.unit_title || s.name || '').toLowerCase().replace(/^(phường|xã|thị trấn|công an phường|công an xã|p\.|x\.|tt\.)\s*/i, '').trim();
            return sW.includes(cleanW) || cleanW.includes(sW);
          });
        }
      }

      if (matchingWardStations.length > 0) {
        matchingWardStations = matchingWardStations.map(s => {
          const dist = citizenRef ? calcHaversineKm(citizenRef.lat, citizenRef.lng, Number(s.lat), Number(s.lng)) : null;
          return { ...s, distanceKm: dist, isNearest: false };
        }).sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

        // De-stack any facilities in the same ward that are < 0.0009 deg apart so all pins are visibly separated on the map
        for (let i = 0; i < matchingWardStations.length; i++) {
          for (let j = i + 1; j < matchingWardStations.length; j++) {
            const a = matchingWardStations[i];
            const b = matchingWardStations[j];
            const dLat = Math.abs(Number(a.lat) - Number(b.lat));
            const dLng = Math.abs(Number(a.lng) - Number(b.lng));
            if (dLat < 0.0009 && dLng < 0.0009) {
              const angle = (2 * Math.PI * j) / Math.max(matchingWardStations.length, 2);
              b.lat = Number((Number(b.lat) + 0.00115 * Math.sin(angle)).toFixed(6));
              b.lng = Number((Number(b.lng) + 0.00115 * Math.cos(angle)).toFixed(6));
            }
          }
        }

        if (matchingWardStations[0]) {
          matchingWardStations[0].isNearest = true;
        }

        if (!station) {
          station = matchingWardStations[0];
        } else {
          const matchedInList = matchingWardStations.find(s => s.id === station.id);
          if (matchedInList) station = matchedInList;
        }
      }
    }

    if (!station) {
      station = {
        name: 'Công An ' + wardName,
        unit_title: wardName,
        ward: wardName,
        province: provName,
        address: p.trungTamHanhChinh || p.address || ('Trụ sở Công An ' + wardName),
        phone: p.phone || '024 3939 6789',
        officer: p.officer || 'Trực ban CAX/CAP',
        officer_name: p.officer_name || '',
        officer_phone: p.officer_phone || '',
        email: p.email || '',
        services: p.services || 'Đăng ký cư trú, đăng ký phương tiện giao thông, phản ánh về ANTT',
        lat: centerLat,
        lng: centerLng,
        distanceKm: citizenRef ? calcHaversineKm(citizenRef.lat, citizenRef.lng, centerLat, centerLng) : null,
        isNearest: true
      };
    }

    const hasGps = Boolean(station && station.lat && station.lng && !isNaN(Number(station.lat)) && !isNaN(Number(station.lng)) && Number(station.lat) !== 0);
    const pinLng = hasGps ? Number(station.lng) : centerLng;
    const pinLat = hasGps ? Number(station.lat) : centerLat;

    const baseName = station?.name || station?.unit_title || ('Công An ' + wardName);
    const displayName = station?.isNearest && matchingWardStations.length > 1
      ? `${baseName} [Cơ sở gần nhất]`
      : baseName;

    const el = document.createElement('div');
    el.className = 'custom-map-pin congan-station-pin permanent-station neon-selected active-ward-reveal-pin';
    el.innerHTML = `
      <div class="congan-pin-emblem-wrap" style="width: 40px !important; height: 40px !important; max-width: 40px !important; max-height: 40px !important; overflow: hidden !important; border-radius: 50% !important; flex-shrink: 0 !important; filter: drop-shadow(0 0 10px #facc15);">
        <img src="/assets/iconcongan.png" width="32" height="32" class="congan-pin-emblem" style="width: 32px !important; height: 32px !important; max-width: 32px !important; max-height: 32px !important; object-fit: contain !important; display: block !important;" alt="Huy hiệu CAND" />
      </div>
      <div class="congan-pin-label" style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #facc15; color: #fef08a; font-weight: 800; font-size: 11.5px; box-shadow: 0 4px 14px rgba(0,0,0,0.8);">
        ${displayName}
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const disp = window.dispatcher || window.dispatcherApp;
      if (disp && typeof disp.showWardHud === 'function') {
        disp.showWardHud(wardFeature, station, matchingWardStations);
      }
    });

    this.activeWardStationId = station?.id || null;
    this.activeWardCoords = [pinLng, pinLat];
    this.activeWardAllStationIds = new Set(matchingWardStations.map(s => s.id));
    if (this.activeWardStationId) this.activeWardAllStationIds.add(this.activeWardStationId);

    // Do NOT attach or open a redundant right-side MapLibre popup; only display the left HUD (#tacticalWardGeofenceHud)
    this.activeWardStationMarker = new window.maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([pinLng, pinLat])
      .addTo(this.map);

    // Mount auxiliary pins for any other facilities in this ward so all facilities are visible simultaneously
    this.activeWardAuxiliaryMarkers = [];
    const otherFacilities = matchingWardStations.filter(s => s.id !== station.id);
    otherFacilities.forEach(auxStation => {
      if (!auxStation.lat || !auxStation.lng) return;
      const auxEl = document.createElement('div');
      auxEl.className = 'custom-map-pin congan-station-pin permanent-station auxiliary-ward-pin';
      const auxBaseName = auxStation.name || auxStation.facility_type || ('Công An ' + wardName);
      const auxLabel = `${auxBaseName}${typeof auxStation.distanceKm === 'number' ? ` (${auxStation.distanceKm} km)` : ''}`;
      auxEl.innerHTML = `
        <div class="congan-pin-emblem-wrap" style="width: 36px !important; height: 36px !important; max-width: 36px !important; max-height: 36px !important; overflow: hidden !important; border-radius: 50% !important; flex-shrink: 0 !important; border: 1.5px solid #38bdf8; box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);">
          <img src="/assets/iconcongan.png" width="28" height="28" class="congan-pin-emblem" style="width: 28px !important; height: 28px !important; max-width: 28px !important; max-height: 28px !important; object-fit: contain !important; display: block !important;" alt="Huy hiệu CAND" />
        </div>
        <div class="congan-pin-label" style="background: rgba(15, 23, 42, 0.95); border: 1.5px solid #38bdf8; color: #38bdf8; font-weight: 700; font-size: 11px; box-shadow: 0 4px 12px rgba(0,0,0,0.7);">
          ${auxLabel}
        </div>
      `;

      auxEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const disp = window.dispatcher || window.dispatcherApp;
        if (disp && typeof disp.showWardHud === 'function') {
          disp.showWardHud(wardFeature, auxStation, matchingWardStations);
        }
      });

      const auxMarker = new window.maplibregl.Marker({ element: auxEl, anchor: 'center' })
        .setLngLat([Number(auxStation.lng), Number(auxStation.lat)])
        .addTo(this.map);

      this.activeWardAuxiliaryMarkers.push(auxMarker);
    });

    // Expose ward facilities to dispatcher HUD if open
    const disp = window.dispatcher || window.dispatcherApp;
    if (disp && typeof disp.showWardHud === 'function' && matchingWardStations.length > 0) {
      try { disp.lastWardFacilities = matchingWardStations; } catch (_) {}
    }

    // Synchronize visible pins to remove duplicate overlay
    this.updateVisibleStationPins();
  }

  clearStationMarkers() {
    if (this.stationMarkers && Array.isArray(this.stationMarkers)) {
      this.stationMarkers.forEach(m => { try { m.remove(); } catch(e) {} });
    }
    this.stationMarkers = [];
    if (this.activeStationMarkersMap) {
      this.activeStationMarkersMap.forEach(m => { try { m.remove(); } catch(e) {} });
      this.activeStationMarkersMap.clear();
    }
    if (this.currentSelectedPinEl) {
      this.currentSelectedPinEl.classList.remove('neon-selected');
      this.currentSelectedPinEl = null;
    }
  }

  removeClusteredStationsLayers() {
    if (!this.map) return;
    const clusterLayers = [
      'stations-cluster-count-layer',
      'stations-clusters-layer',
      'stations-unclustered-point-layer'
    ];
    clusterLayers.forEach(l => {
      if (this.map.getLayer(l)) {
        try { this.map.removeLayer(l); } catch(e) {}
      }
    });
    if (this.map.getSource('stations-cluster-source')) {
      try { this.map.removeSource('stations-cluster-source'); } catch(e) {}
    }
  }

  isNonOperationalStation(st) {
    if (!st) return true;
    const text = `${st.name || ''} ${st.unit_title || ''} ${st.address || ''}`.toLowerCase();
    const nonOpPatterns = [
      'bảo tàng công an',
      'báo an ninh thủ đô',
      'bệnh viện catp',
      'bệnh viện công an',
      'nhà khách',
      'nhà nghỉ dưỡng',
      'công ty tnhh',
      'trung tâm huấn luyện và bồi dưỡng',
      'trại tạm giam',
      'nhà tạm giữ',
      'cơ sở cai nghiện',
      'văn phòng cơ quan cảnh sát điều tra',
      'phòng cảnh sát kinh tế',
      'phòng cảnh sát điều tra tội phạm về tham nhũng',
      'phòng cảnh sát quản lý hành chính về trật tự xã hội',
      'phòng quản lý xuất nhập cảnh',
      'thanh tra catp',
      'thanh tra công an',
      'phòng cảnh sát hình sự',
      'phòng cảnh sát cơ động',
      'phòng cảnh sát điều tra tội phạm về ma túy',
      'phòng hồ sơ nghiệp vụ',
      'cơ sở đăng ký xe',
      'đội sát hạch',
      'đội chỉ huy giao thông và đèn tín hiệu'
    ];
    return nonOpPatterns.some(kw => text.includes(kw));
  }

  async getStationsData() {
    if (this.cachedStations && Array.isArray(this.cachedStations) && this.cachedStations.length > 0) {
      this.stationsData = this.cachedStations;
      return this.cachedStations;
    }
    try {
      const res = await fetch('/api/stations/all');
      const data = await res.json();
      if (data.ok && Array.isArray(data.stations)) {
        const cleanStations = data.stations.filter(s => !this.isNonOperationalStation(s));
        this.cachedStations = cleanStations;
        this.stationsData = cleanStations;
        return this.cachedStations;
      }
    } catch (e) {
      console.warn('Error loading stations:', e);
    }
    return [];
  }

  zoomToCoordinates(lng, lat, targetZoom = null) {
    if (!this.map) return;
    const currentZ = this.map.getZoom();
    const nextZ = targetZoom || Math.min(currentZ + 2.5, 14.5);
    this.map.flyTo({
      center: [lng, lat],
      zoom: nextZ,
      essential: true,
      duration: 750
    });
  }

  createPoliceStationPopupHtml(st, wardFeature = null, allWardStations = []) {
    const p = wardFeature?.properties || {};
    const unitTitle = st.name || st.unit_title || (st.ward ? ('Công An ' + st.ward) : (p.ward ? ('Công An ' + p.ward) : 'Công An Địa Bàn'));
    const facilityType = st.facility_type || 'Trụ sở chính';
    const address = st.address || p.address || p.trungTamHanhChinh || 'Trụ sở Công An';
    const phone = (st.phone && !st.phone.includes('cập nhật')) ? st.phone : (p.phone || '024 3939 6789');
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    let officerDisplay = st.officer || st.truongca || '';
    if (!officerDisplay || officerDisplay.includes('cập nhật') || officerDisplay.includes('CAX/CAP')) {
      if (st.officer_name) {
        officerDisplay = st.officer_name + (st.officer_phone ? ` (SĐT: ${st.officer_phone})` : '');
      } else if (p.officer) {
        officerDisplay = p.officer;
      } else {
        officerDisplay = 'Nguyễn Minh Hoàng (SĐT: 0919123419)';
      }
    }

    const email = st.email || p.email || 'phuongtanan@cantho.gov.vn';
    const services = st.services || st.description_2 || p.services || 'Đăng ký cư trú, tiếp nhận tin báo, ANTT';
    const lat = (st.lat && !isNaN(Number(st.lat))) ? Number(st.lat) : (p.center?.[1] || 10.039822);
    const lng = (st.lng && !isNaN(Number(st.lng))) ? Number(st.lng) : (p.center?.[0] || 105.75825);
    const gmapsUrl = st.maps_url || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    // Area info optional expansion
    const sapNhap = p.sapNhapTu || p.sap_nhap || '';
    const dienTich = p.dienTich || (p.dtich_km2 ? (String(p.dtich_km2).replace('.', ',') + ' (km²)') : '');
    const danSo = p.danSo || (p.dan_so ? (Number(p.dan_so).toLocaleString('vi-VN') + ' (người)') : '');
    const maDVHC = p.maDVHC || p.ma_xa || '';

    const facilitiesList = Array.isArray(allWardStations) && allWardStations.length > 0 ? allWardStations : [st];
    const isCurrentNearest = Boolean(st.isNearest || (facilitiesList.length > 0 && facilitiesList[0]?.id === st.id));

    return `
      <div class="cantho-official-popup-card" style="font-family: 'Hubot Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1c1917; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 14px 16px; color: #ffffff; min-width: 320px; max-width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.85); text-align: left;">
        <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
          <img src="/assets/iconcongan.png" style="width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.5));" alt="Huy hiệu CAND" />
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 3px;">
              <span style="background: #ea580c; color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 800; text-transform: uppercase;">${facilityType}</span>
              ${isCurrentNearest ? `<span class="nearest-facility-badge" style="background: #10b981; color: #052e16; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 900;">[Cơ sở gần nhất]${typeof st.distanceKm === 'number' ? ` • ${st.distanceKm} km` : ''}</span>` : (typeof st.distanceKm === 'number' ? `<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">📏 ${st.distanceKm} km</span>` : '')}
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #facc15; line-height: 1.25; margin-bottom: 3px;">
              ${unitTitle}
            </div>
            <div style="font-size: 12px; color: #f4f4f5; line-height: 1.45; word-break: break-word;">
              ${address}
            </div>
          </div>
        </div>

        <div style="margin-top: 10px; margin-bottom: 8px;">
          <div style="color: #22c55e; font-size: 12px; font-weight: 600; margin-bottom: 2px;">
            Số điện thoại trực ban
          </div>
          <a href="tel:${cleanPhone}" style="text-decoration: none; display: inline-block;">
            <div style="color: #22c55e; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(34, 197, 94, 0.35);">
              ${phone}
            </div>
          </a>
        </div>

        <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.15); margin: 8px 0 10px 0;" />

        <div style="font-size: 12px; color: #f4f4f5; line-height: 1.6; margin-bottom: 12px;">
          <div style="margin-bottom: 4px;">
            <b>- Trực ban/Chỉ huy:</b> <span>${officerDisplay}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <b>- Thủ tục, giải quyết:</b> <span style="color: #93c5fd;">${services}</span>
          </div>
        </div>

        <div style="margin-top: 10px; margin-bottom: 6px;">
          <a href="${gmapsUrl}" target="_blank" rel="noopener" style="display: block; width: 100%; text-align: center; background: #c2410c; color: #ffffff; padding: 9px 0; border-radius: 6px; font-size: 13.5px; font-weight: 800; text-decoration: none; box-shadow: 0 4px 12px rgba(194, 65, 12, 0.45); transition: all 0.2s ease;">
            📍 Xem Bản Đồ (Chỉ đường Google Maps)
          </a>
        </div>

        ${facilitiesList.length > 1 ? `
        <div class="ward-multi-facility-drawer-list" style="margin-top: 10px; padding: 8px 10px; background: rgba(30, 41, 59, 0.7); border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.25);">
          <div style="font-size: 11px; font-weight: 800; color: #38bdf8; margin-bottom: 6px; text-transform: uppercase;">
            🏢 Toàn bộ cơ sở thuộc địa bàn (${facilitiesList.length} cơ sở):
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 165px; overflow-y: auto;">
            ${facilitiesList.map((fac, idx) => {
              const facNearest = Boolean(fac.isNearest || idx === 0);
              const facDist = typeof fac.distanceKm === 'number' ? `${fac.distanceKm} km` : '';
              return `
              <div class="ward-facility-item" data-facility-id="${fac.id || ''}" style="font-size: 11px; padding: 6px 8px; border-radius: 5px; background: ${fac.id === st.id ? 'rgba(234, 88, 12, 0.25)' : 'rgba(15, 23, 42, 0.65)'}; border: 1px solid ${facNearest ? '#10b981' : (fac.id === st.id ? '#ea580c' : 'rgba(255,255,255,0.08)')};">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; flex-wrap: wrap;">
                  <span style="font-weight: 800; color: ${fac.id === st.id ? '#facc15' : '#38bdf8'};">${fac.name}</span>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="background: rgba(234,88,12,0.25); color: #fdba74; padding: 1px 5px; border-radius: 3px; font-size: 9.5px; font-weight: 700;">${fac.facility_type || 'Cơ sở'}</span>
                    ${facDist ? `<span class="facility-distance-km" style="background: rgba(56,189,248,0.2); color: #38bdf8; padding: 1px 5px; border-radius: 3px; font-size: 9.5px; font-weight: 800;">${facDist}</span>` : ''}
                    ${facNearest ? `<span class="nearest-facility-tag" style="background: #10b981; color: #052e16; padding: 1px 5px; border-radius: 3px; font-size: 9.5px; font-weight: 900;">[Cơ sở gần nhất]</span>` : ''}
                  </div>
                </div>
                <div style="color: #cbd5e1; font-size: 10px; margin-top: 2px;">📍 ${fac.address}</div>
                <div style="color: #93c5fd; font-size: 9.5px; margin-top: 2px;">📋 ${fac.services || 'Tiếp nhận tố giác tội phạm, cư trú, ANTT'}</div>
                <div style="color: #22c55e; font-size: 10px; font-weight: 700; margin-top: 2px;">📞 ${fac.phone || '024 3939 6789'}</div>
              </div>
            `}).join('')}
          </div>
        </div>` : ''}
          <details style="font-size: 11px; color: #94a3b8; cursor: pointer;">
            <summary style="color: #fbbf24; font-weight: 700; outline: none;">THÔNG TIN ĐỊA BÀN (Xem thêm)</summary>
            <div style="margin-top: 5px; line-height: 1.5; color: #cbd5e1; padding-left: 6px;">
              ${sapNhap ? `<div style="color: #60a5fa; margin-bottom: 2px;"><b>Sáp nhập từ:</b> ${sapNhap}</div>` : ''}
              ${dienTich ? `<div style="color: #cbd5e1; margin-bottom: 2px;">- <b>Diện tích:</b> <span style="color: #fbbf24; font-weight: 700;">${dienTich}</span> &nbsp;|&nbsp; <b>Dân số:</b> <span style="color: #fbbf24; font-weight: 700;">${danSo}</span></div>` : ''}
              ${maDVHC ? `<div style="color: #cbd5e1; margin-bottom: 2px;">- <b>Mã số ĐVHC:</b> <span style="color: #38bdf8; font-weight: 800;">${maDVHC}</span></div>` : ''}
            </div>
          </details>
        </div>
      </div>
    `;
  }

  createPoliceClusterPopupHtml(cluster) {
    const stationList = cluster.stations || [];
    const displayStations = stationList.slice(0, 5);
    const remainingCount = stationList.length - displayStations.length;

    return `
      <div class="tactical-police-popup-card" style="font-family: 'Hubot Sans', system-ui, -apple-system, sans-serif; background: rgba(15, 23, 42, 0.96); border: 1.5px solid rgba(250, 204, 21, 0.6); border-radius: 12px; padding: 14px; color: #f8fafc; min-width: 300px; max-width: 350px; box-shadow: 0 12px 35px rgba(0, 0, 0, 0.8), 0 0 30px rgba(250, 204, 21, 0.35); backdrop-filter: blur(12px);">
        <div style="display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 10px;">
          <img src="/assets/iconcongan.png" style="width: 46px; height: 46px; object-fit: contain; filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.9)); margin-right: 10px; flex-shrink: 0;" />
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 9px; font-weight: 800; letter-spacing: 0.8px; color: #facc15; text-transform: uppercase; margin-bottom: 2px;">
              🛡️ BỘ CÔNG AN — CỤM LỰC LƯỢNG VŨ TRANG
            </div>
            <div style="font-size: 13.5px; font-weight: 800; color: #ffffff; line-height: 1.35;">
              Cụm Công An (${stationList.length} Đồn Trạm & Trụ Sở)
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; background: rgba(2, 132, 199, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; font-size: 11px;">
          <span style="color: #94a3b8;">Tổng đơn vị: <b style="color: #f8fafc;">${stationList.length} cơ quan</b></span>
          <span style="color: #22c55e; font-weight: 700;">● Trực chiến 24/7</span>
        </div>

        <div style="font-size: 10.5px; font-weight: 700; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
          Danh sách đồn trạm trong cụm:
        </div>

        <div style="max-height: 130px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; padding-right: 4px;">
          ${displayStations.map(st => `
            <div style="background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 5px 8px; font-size: 11px;">
              <div style="font-weight: 700; color: #38bdf8;">👮‍♂️ ${st.name}</div>
              <div style="display: flex; justify-content: space-between; color: #94a3b8; font-size: 10px; margin-top: 2px;">
                <span>📍 ${st.ward || st.province || ''}</span>
                <a href="tel:${st.phone}" style="color: #facc15; text-decoration: none; font-weight: 700;">📞 ${st.phone}</a>
              </div>
            </div>
          `).join('')}
          ${remainingCount > 0 ? `<div style="text-align: center; color: #94a3b8; font-size: 10px; padding: 4px 0; font-style: italic;">... và ${remainingCount} đồn trạm khác</div>` : ''}
        </div>

        <button onclick="window.dispatcherApp?.mapController?.zoomToCoordinates(${cluster.lng}, ${cluster.lat})" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #0284c7, #0369a1); color: white; border: 1px solid #38bdf8; border-radius: 8px; padding: 8px 12px; font-size: 11.5px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.5); transition: all 0.2s;">
          🔍 Thu phóng mở rộng cụm này
        </button>
      </div>
    `;
  }

  renderClusterPin(cluster) {
    const el = document.createElement('div');
    el.className = 'custom-map-pin congan-cluster-pin';
    el.innerHTML = `
      <div class="congan-pin-emblem-wrap">
        <img src="/assets/iconcongan.png" class="congan-pin-emblem" alt="Huy hiệu CAND" />
        <span class="congan-count-badge">${cluster.count}</span>
      </div>
      <div class="congan-pin-label">Công An (${cluster.count} đồn)</div>
    `;

    const popupContent = this.createPoliceClusterPopupHtml(cluster);
    const popup = new window.maplibregl.Popup({ offset: 25, closeButton: true })
      .setHTML(popupContent);

    popup.on('close', () => {
      if (this.currentSelectedPinEl === el) {
        el.classList.remove('neon-selected');
        this.currentSelectedPinEl = null;
      }
    });

        el.addEventListener('click', async () => {
      if (this.currentSelectedPinEl) {
        this.currentSelectedPinEl.classList.remove('neon-selected');
      }
      el.classList.add('neon-selected');
      this.currentSelectedPinEl = el;

      // Tự động khoanh vùng tô tím địa bàn phường xã của Công an khu vực khi được chọn
      try {
        const queryParams = new URLSearchParams({
          lat: exactLat,
          lng: exactLng,
          ward: st.ward || '',
          province: st.province || '',
          address: st.address || st.name || ''
        });
        const res = await fetch('/api/geo/locate-ward?' + queryParams.toString());
        const data = await res.json();
        if (data.ok && data.boundary) {
          this.highlightWardBoundary(data.boundary, { fitBounds: false });
          if (window.dispatcherApp && typeof window.dispatcherApp.showWardHud === 'function') {
            window.dispatcherApp.showWardHud(data.boundary);
          }
        }
      } catch (e) {
        console.warn('Could not highlight station ward boundary on click:', e);
      }
    });

    const marker = new window.maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([cluster.lng, cluster.lat])
      .setPopup(popup)
      .addTo(this.map);

    this.stationMarkers.push(marker);
  }

  createStationMarker(st) {
    if (!st || !st.lat || !st.lng || st.id === 'st-admin' || st.level === 'national') {
      return null;
    }
    const isNational = st.level === 'national' || st.id === 'st-admin' || (st.name && st.name.toLowerCase().includes('quốc gia'));
    const isPolice = st.agency === 'police' || isNational;

    const el = document.createElement('div');
    if (isPolice) {
      el.className = 'custom-map-pin congan-station-pin permanent-station' + (isNational ? ' pin-national-hq' : '');
      el.innerHTML = `
        <div class="congan-pin-emblem-wrap ${isNational ? 'pin-national-hq' : ''}" style="width: 40px !important; height: 40px !important; max-width: 40px !important; max-height: 40px !important; overflow: hidden !important; border-radius: 50% !important; flex-shrink: 0 !important;">
          <img src="/assets/iconcongan.png" width="32" height="32" class="congan-pin-emblem" style="width: 32px !important; height: 32px !important; max-width: 32px !important; max-height: 32px !important; object-fit: contain !important; display: block !important;" alt="Huy hiệu CAND" />
        </div>
        <div class="congan-pin-label">${isNational ? '★ ' : ''}${st.name}</div>
      `;
    } else {
      const icon = st.agency === 'hospital' ? '🏥' : (st.agency === 'csgt' ? '🚓' : '🚒');
      const colorClass = st.agency === 'hospital' ? 'green' : (st.agency === 'csgt' ? 'blue' : 'orange');
      el.className = 'custom-map-pin station-pin permanent-station';
      el.innerHTML = `
        <div class="pin-core ${colorClass}">
          <span>${icon}</span>
        </div>
        <div class="pin-tooltip">${st.name}</div>
      `;
    }

    const exactLng = Number(st.lng || st.stationLng);
    const exactLat = Number(st.lat || st.stationLat);

    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (this.currentSelectedPinEl) {
        this.currentSelectedPinEl.classList.remove('neon-selected');
      }
      el.classList.add('neon-selected');
      this.currentSelectedPinEl = el;

      const isProvinceLevel = st.level === 'province' || 
        (st.name && (st.name.includes('Công An TP.') || st.name.includes('Công An Tỉnh') || st.name.includes('Bộ Chỉ Huy')) && !st.name.includes('Phường') && !st.name.includes('Xã')) ||
        (st.ward === 'Toàn Thành Phố' || st.ward === 'Toàn Tỉnh');

      if (isProvinceLevel) {
        this.clearWardBoundary();
        this.highlightProvinceBoundary(st.province);
        if (window.dispatcherApp && typeof window.dispatcherApp.showProvinceHud === 'function') {
          window.dispatcherApp.showProvinceHud(st);
        }
        return;
      }

      this.highlightProvinceBoundary(null);
      try {
        const queryParams = new URLSearchParams({
          id: st.wardId || '',
          lat: exactLat,
          lng: exactLng,
          ward: st.ward || '',
          province: st.province || '',
          address: st.address || st.name || ''
        });
        const res = await fetch('/api/geo/locate-ward?' + queryParams.toString());
        const data = await res.json();
        if (data.ok && data.boundary) {
          this.highlightWardBoundary(data.boundary, { fitBounds: false });
          if (window.dispatcherApp && typeof window.dispatcherApp.showWardHud === 'function') {
            window.dispatcherApp.showWardHud(data.boundary, st);
          }
        } else {
          const fallbackFeature = {
            type: 'Feature',
            properties: {
              ward: st.ward,
              province: st.province,
              police: st.name,
              phone: st.phone,
              sms: st.sms,
              officer: st.officer,
              address: st.address,
              center: [exactLng, exactLat]
            }
          };
          if (window.dispatcherApp && typeof window.dispatcherApp.showWardHud === 'function') {
            window.dispatcherApp.showWardHud(fallbackFeature, st);
          }
        }
      } catch (err) {
        console.warn('Error loading ward HUD on pin click:', err);
      }
    });

    const marker = new window.maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([exactLng, exactLat])
      .addTo(this.map);

    return marker;
  }

  renderSingleStationPin(st) {
    const marker = this.createStationMarker(st);
    if (marker) {
      this.stationMarkers.push(marker);
      const id = String(st.id || `${st.name}_${st.lat}_${st.lng}`);
      if (this.activeStationMarkersMap) {
        this.activeStationMarkersMap.set(id, marker);
      }
    }
  }

  updateVisibleStationPins() {
    if (!this.map) return;
    if (this.stationsVisible === false) {
      this.clearStationMarkers();
      return;
    }

    const zoom = this.map.getZoom();
    const isFilteredRegion = Boolean(this.currentRegionFilter && this.currentRegionFilter !== 'all' && !this.currentRegionFilter.includes('Quốc'));
    // Macro view: When zoomed way out (< 8.5), show only province/district level hubs so the map stays clean; when zoomed in (>= 8.5), show all ward facilities in viewport
    const isMacroView = zoom < 8.5;

    if (zoom < 5.8 && !isFilteredRegion) {
      if (this.activeStationMarkersMap && this.activeStationMarkersMap.size > 0) {
        this.activeStationMarkersMap.forEach(m => { try { m.remove(); } catch(e) {} });
        this.activeStationMarkersMap.clear();
        this.stationMarkers = [];
      }
      return;
    }

    if (!this.candidateStations || this.candidateStations.length === 0) return;

    // Viewport Culling: Get current map bounds with 10% outer buffer
    const bounds = this.map.getBounds();
    const spanLng = bounds.getEast() - bounds.getWest();
    const spanLat = bounds.getNorth() - bounds.getSouth();
    const west = bounds.getWest() - (spanLng * 0.1);
    const east = bounds.getEast() + (spanLng * 0.1);
    const south = bounds.getSouth() - (spanLat * 0.1);
    const north = bounds.getNorth() + (spanLat * 0.1);

    const visibleStations = this.candidateStations.filter(st => {
      const lng = Number(st.lng || st.stationLng);
      const lat = Number(st.lat || st.stationLat);
      if (isNaN(lng) || isNaN(lat) || lng < west || lng > east || lat < south || lat > north) {
        return false;
      }
      if (isMacroView) {
        const nameLower = (st.name || '').toLowerCase();
        const isWardLevel = st.level === 'ward' || st.level === 'commune' || st.type === 'ward' || st.type === 'commune' ||
          nameLower.startsWith('công an xã') || nameLower.startsWith('công an phường') || nameLower.startsWith('công an thị trấn');
        if (isWardLevel) return false;
      }
      return true;
    });

    const visibleIds = new Set(visibleStations.map(st => String(st.id || `${st.name}_${st.lat}_${st.lng}`)));

    // 1. Unmount markers that have panned out of the viewport
    for (const [id, marker] of this.activeStationMarkersMap.entries()) {
      if (!visibleIds.has(id)) {
        try { marker.remove(); } catch(e) {}
        this.activeStationMarkersMap.delete(id);
      }
    }

    // 2. Mount markers that have entered the viewport
    visibleStations.forEach(st => {
      const id = String(st.id || `${st.name}_${st.lat}_${st.lng}`);
      // Skip mounting if this station is already rendered by activeWardStationMarker or auxiliary pins
      if (this.activeWardStationMarker && (
        (this.activeWardStationId && (st.id === this.activeWardStationId || st.raw_id === this.activeWardStationId)) ||
        (this.activeWardAllStationIds && (this.activeWardAllStationIds.has(st.id) || this.activeWardAllStationIds.has(st.raw_id))) ||
        (this.activeWardCoords && Math.abs(Number(st.lng || st.stationLng) - this.activeWardCoords[0]) < 0.0001 && Math.abs(Number(st.lat || st.stationLat) - this.activeWardCoords[1]) < 0.0001)
      )) {
        if (this.activeStationMarkersMap.has(id)) {
          try { this.activeStationMarkersMap.get(id).remove(); } catch(e) {}
          this.activeStationMarkersMap.delete(id);
        }
        return;
      }

      if (!this.activeStationMarkersMap.has(id)) {
        const marker = this.createStationMarker(st);
        if (marker) {
          this.activeStationMarkersMap.set(id, marker);
        }
      }
    });

    this.stationMarkers = Array.from(this.activeStationMarkersMap.values());
  }

  renderClusteredStations(stations) {
    if (!this.map) return;
    this.clearStationMarkers();
    this.removeClusteredStationsLayers();
    (stations || []).forEach(st => this.renderSingleStationPin(st));
  }

  async loadAllStationsMarkers(filterRegion = null, agency = null, isAdmin = false) {
    if (!this.map) return;

    const allStations = await this.getStationsData();
    if (!allStations || allStations.length === 0) return;

    this.removeClusteredStationsLayers();
    this.clearStationMarkers();

    this.currentRegionFilter = filterRegion;

    this.candidateStations = allStations.filter(s => {
      if (!s.lat || !s.lng || s.id === 'st-admin' || s.level === 'national') return false;
      if (this.isNonOperationalStation(s)) return false;

      if (agency && agency !== 'all' && s.level !== 'national' && s.id !== 'st-admin') {
        if (agency === 'fire') return s.agency === 'fire' || s.agency === 'rescue';
        return s.agency === agency;
      }
      return true;
    });

    // Attach viewport culling map events (only once)
    if (!this._viewportCullingBound && this.map) {
      this._viewportCullingBound = true;
      let debounceTimer = null;
      const onMapMove = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.updateVisibleStationPins();
        }, 70);
      };
      this.map.on('move', onMapMove);
      this.map.on('moveend', () => this.updateVisibleStationPins());
      this.map.on('zoomend', () => this.updateVisibleStationPins());
    }

    // Immediately render visible stations based on current zoom & bounds
    this.updateVisibleStationPins();
  }

  reloadStationsMarkers(region = 'all', agency = null, isAdmin = false) {
    this.loadAllStationsMarkers(region, agency, isAdmin);
  }

  enableAdminAddStationMode(onCoordsSelected) {
    if (!this.map) return;
    this.adminAddStationMode = true;
    this.map.getCanvas().style.cursor = 'crosshair';

    this.adminMapClickHandler = async (e) => {
      if (!this.adminAddStationMode) return;
      const { lng, lat } = e.lngLat;

      // Add temporary dropped pin marker
      if (this.tempAdminPin) this.tempAdminPin.remove();

      const el = document.createElement('div');
      el.className = 'custom-map-pin station-pin pulse-alert';
      el.innerHTML = `
        <div class="pin-core blue" style="width: 34px; height: 34px; font-size: 16px; border: 2px solid #fbbf24; box-shadow: 0 0 16px #eab308;">
          <span>📍</span>
        </div>
        <div class="pin-tooltip" style="font-size: 10px; font-weight: 800; color: #fbbf24;">Ghim Vị Trí Đồn Mới</div>
      `;

      this.tempAdminPin = new window.maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(this.map);

      this.tempAdminPin.on('dragend', () => {
        const pt = this.tempAdminPin.getLngLat();
        if (onCoordsSelected) {
          onCoordsSelected({ lat: parseFloat(pt.lat.toFixed(6)), lng: parseFloat(pt.lng.toFixed(6)) });
        }
      });

      let detectedAddress = `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const res = await fetch(`/api/geo/locate-ward?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        if (data.ok && data.jurisdiction) {
          detectedAddress = `${data.jurisdiction.ward || ''}, ${data.jurisdiction.province || 'Cần Thơ'}`;
        }
      } catch (err) {}

      if (onCoordsSelected) {
        onCoordsSelected({
          lat: parseFloat(lat.toFixed(6)),
          lng: parseFloat(lng.toFixed(6)),
          address: detectedAddress
        });
      }
    };

    this.map.once('click', this.adminMapClickHandler);
  }

  disableAdminAddStationMode() {
    this.adminAddStationMode = false;
    if (this.map) this.map.getCanvas().style.cursor = '';
    if (this.tempAdminPin) {
      this.tempAdminPin.remove();
      this.tempAdminPin = null;
    }
  }

  async initAllWardsLayer(onWardClick = null, onWardHover = null) {
    if (!this.map) return;

    try {
      const res = await fetch('/api/geo/all-wards');
      const data = await res.json();
      if (!data.ok || !data.boundaries) return;

      // Store complete nationwide GeoJSON and build fast lookup indices
      this.allWardsData = data.boundaries;
      this.wardsById = new Map();
      this.wardsByProvWard = new Map();
      if (Array.isArray(data.boundaries.features)) {
        data.boundaries.features.forEach(f => {
          const p = f.properties || {};
          if (p.id) this.wardsById.set(String(p.id).toLowerCase().trim(), f);
          if (f.id) this.wardsById.set(String(f.id).toLowerCase().trim(), f);
          if (p.ward && p.province) {
            const cleanP = p.province.trim().toLowerCase();
            const rawW = p.ward.trim().toLowerCase();
            const cleanW = rawW.replace(/^(phường|xã|thị trấn)\s+/i, '').trim();
            this.wardsByProvWard.set(`${cleanP}___${rawW}`, f);
            this.wardsByProvWard.set(`${cleanP}___${cleanW}`, f);
          }
        });
      }

      const sourceId = 'vn-all-wards-source';
      const fillLayerId = 'vn-all-wards-fill';
      const lineLayerId = 'vn-all-wards-line';
      const glowLayerId = 'vn-all-wards-glow';
      const labelLayerId = 'vn-all-wards-label';

      const initialVisibility = this.allWardsVisible ? 'visible' : 'none';

      const setupLayers = () => {
        if (this.map.getSource(sourceId)) {
          this.map.getSource(sourceId).setData(data.boundaries);
          this.toggleAllWardsLayer(this.allWardsVisible);
          return;
        }

        this.map.addSource(sourceId, {
          type: 'geojson',
          data: data.boundaries
        });

        const beforeLayer = this.map.getLayer('vn-provinces-shadow') ? 'vn-provinces-shadow' : undefined;

        // 1. All Wards Ambient Outer Glow
        this.map.addLayer({
          id: glowLayerId,
          type: 'line',
          source: sourceId,
          layout: { 'visibility': initialVisibility },
          paint: {
            'line-color': '#f59e0b',
            'line-width': 6,
            'line-blur': 4,
            'line-opacity': 0.5
          }
        }, beforeLayer);

        // 2. All Wards Translucent Pastel Polygon Fill
        this.map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          layout: { 'visibility': initialVisibility },
          paint: {
            'fill-color': ['coalesce', ['get', 'color'], '#a855f7'],
            'fill-opacity': 0.35
          }
        }, beforeLayer);

        // 3. All Wards Crisp Yellow Boundary Line
        this.map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          layout: { 'visibility': initialVisibility },
          paint: {
            'line-color': '#fbbf24',
            'line-width': 1.8,
            'line-opacity': 0.95
          }
        }, beforeLayer);

        // 4. All Wards Dynamic Text Label Layer
        this.map.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          minzoom: 10,
          layout: {
            'visibility': initialVisibility,
            'text-field': ['get', 'ward'],
            'text-font': ['Open Sans Semibold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 13, 17, 16],
            'text-anchor': 'center',
            'text-allow-overlap': false
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0, 0, 0, 0.85)',
            'text-halo-width': 2
          }
        });

        // Mouse Events
        this.map.on('mouseenter', fillLayerId, (e) => {
          this.map.getCanvas().style.cursor = 'pointer';
          if (e.features && e.features[0] && onWardHover) {
            onWardHover(e.features[0]);
          }
        });

        this.map.on('mouseleave', fillLayerId, () => {
          this.map.getCanvas().style.cursor = '';
        });

        this.map.on('click', fillLayerId, (e) => {
          if (e.features && e.features[0]) {
            const clicked = e.features[0];
            const p = clicked.properties || {};

            // CRITICAL: Look up the original unclipped GeoJSON feature so we never get a sliced vector tile!
            let fullFeature = null;
            if (p.id) {
              fullFeature = this.wardsById?.get(String(p.id).toLowerCase().trim());
            }
            if (!fullFeature && p.province && p.ward) {
              const cleanP = p.province.trim().toLowerCase();
              const rawW = p.ward.trim().toLowerCase();
              const cleanW = rawW.replace(/^(phường|xã|thị trấn)\s+/i, '').trim();
              fullFeature = this.wardsByProvWard?.get(`${cleanP}___${rawW}`) ||
                            this.wardsByProvWard?.get(`${cleanP}___${cleanW}`);
            }

            const targetFeature = fullFeature || clicked;
            this.highlightWardBoundary(targetFeature);
            if (onWardClick) onWardClick(targetFeature);
          }
        });
      };

      if (this.map.loaded()) {
        setupLayers();
      } else {
        this.map.once('load', setupLayers);
      }
    } catch (e) {
      console.warn('Could not init all wards layer:', e);
    }
  }

  toggleAllWardsLayer(visible = true) {
    this.allWardsVisible = visible;
    // Persist state so page reload remembers user preference
    try { localStorage.setItem('allWardsVisible', visible); } catch (e) {}
    if (!this.map) return;
    const visibility = visible ? 'visible' : 'none';
    const layers = ['vn-all-wards-fill', 'vn-all-wards-line', 'vn-all-wards-glow', 'vn-all-wards-label'];
    layers.forEach(l => {
      if (this.map.getLayer(l)) {
        this.map.setLayoutProperty(l, 'visibility', visibility);
        // When making visible, ensure the layer is on top of base tiles
        if (visible) this.map.moveLayer(l);
      }
    });
    // Move province overlay back on top after ward layers
    if (visible) {
      if (this.map.getLayer('vn-provinces-boundary')) this.map.moveLayer('vn-provinces-boundary');
      if (this.map.getLayer('vn-province-labels')) this.map.moveLayer('vn-province-labels');
    }
  }

  highlightWardBoundary(boundaryGeoJSON, options = {}) {
    if (!this.map || !boundaryGeoJSON) return;

    const sourceId = 'ward-boundary-source';
    const fillLayerId = 'ward-boundary-fill';
    const lineLayerId = 'ward-boundary-line';
    const glowLayerId = 'ward-boundary-glow';

    const color = options.color || boundaryGeoJSON.properties?.color || '#facc15';

    const executeRender = () => {
      let featureData = boundaryGeoJSON;
      if (boundaryGeoJSON.type !== 'Feature' && boundaryGeoJSON.type !== 'FeatureCollection') {
        featureData = {
          type: 'Feature',
          properties: boundaryGeoJSON.properties || {},
          geometry: boundaryGeoJSON
        };
      }

      // Check if feature can be resolved to full unclipped geometry from cache
      if (featureData && featureData.properties) {
        const p = featureData.properties;
        let original = null;
        if (p.id) {
          original = this.wardsById?.get(String(p.id).toLowerCase().trim());
        }
        if (!original && p.province && p.ward) {
          const cleanP = p.province.trim().toLowerCase();
          const rawW = p.ward.trim().toLowerCase();
          const cleanW = rawW.replace(/^(phường|xã|thị trấn)\s+/i, '').trim();
          original = this.wardsByProvWard?.get(`${cleanP}___${rawW}`) ||
                     this.wardsByProvWard?.get(`${cleanP}___${cleanW}`);
        }
        if (original && original.geometry) {
          featureData = {
            type: 'Feature',
            properties: { ...original.properties, ...(p || {}) },
            geometry: original.geometry
          };
        }
      }

      this.currentWardBoundary = featureData;
      if (options.showPin !== false) {
        this.showWardStationPin(featureData);
      }

      if (this.map.getSource(sourceId)) {
        this.map.getSource(sourceId).setData(featureData);
      } else {
        this.map.addSource(sourceId, {
          type: 'geojson',
          data: featureData
        });

        // 1. High-Tech Luminous Outer Glow
        this.map.addLayer({
          id: glowLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#f59e0b',
            'line-width': 12,
            'line-blur': 6,
            'line-opacity': 0.85
          }
        });

        // 2. High-Tech Semi-Transparent Purple/Amber Geofence Fill
        this.map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#a855f7',
            'fill-opacity': 0.30
          }
        });

        // 3. Crisp Bright Yellow Boundary Stroke
        this.map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#facc15',
            'line-width': 3.5,
            'line-opacity': 1.0
          }
        });
      }

      // CRITICAL: Always ensure layers are visible
      [glowLayerId, fillLayerId, lineLayerId].forEach(id => {
        if (this.map.getLayer(id)) {
          this.map.setLayoutProperty(id, 'visibility', 'visible');
        }
      });

      // Move layers to the top of the vector overlays
      if (this.map.getLayer(glowLayerId)) this.map.moveLayer(glowLayerId);
      if (this.map.getLayer(fillLayerId)) this.map.moveLayer(fillLayerId);
      if (this.map.getLayer(lineLayerId)) this.map.moveLayer(lineLayerId);

      // Fit bounds smoothly to ward polygon (only if not explicitly disabled)
      if (options.fitBounds !== false) {
        try {
          const bounds = new window.maplibregl.LngLatBounds();
          const pts = [];
          const extractPoints = (arr) => {
            if (!arr) return;
            if (Array.isArray(arr) && arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number' && !isNaN(arr[0]) && !isNaN(arr[1])) {
              pts.push(arr);
            } else if (Array.isArray(arr)) {
              for (let i = 0; i < arr.length; i++) extractPoints(arr[i]);
            }
          };

          const geom = featureData.geometry || featureData.features?.[0]?.geometry;
          if (geom && geom.coordinates) {
            extractPoints(geom.coordinates);
          }

          if (pts.length > 0) {
            pts.forEach(pt => {
              bounds.extend([pt[0], pt[1]]);
            });
            const isMob = window.innerWidth <= 768;
            const fitPad = isMob ? { top: 70, bottom: 90, left: 24, right: 24 } : { top: 60, bottom: 90, left: 60, right: 380 };
            this.map.fitBounds(bounds, { padding: fitPad, maxZoom: 14.5, duration: 1000 });
          } else if (featureData.properties?.center) {
            const c = featureData.properties.center;
            this.map.flyTo({ center: [c[0], c[1]], zoom: 14, duration: 1000 });
          }
        } catch (e) {
          console.warn('Could not fit bounds to ward polygon:', e);
        }
      }
    };

    if (this.map.loaded()) {
      executeRender();
    } else {
      this.map.once('load', executeRender);
    }
  }

  clearWardBoundary() {
    this.currentWardBoundary = null;
    this.clearActiveWardPin();
    this.updateVisibleStationPins();
    if (!this.map) return;
    const sourceId = 'ward-boundary-source';
    if (this.map.getSource(sourceId)) {
      this.map.getSource(sourceId).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
    ['ward-boundary-fill', 'ward-boundary-glow', 'ward-boundary-line'].forEach(id => {
      if (this.map.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', 'none');
      }
    });
  }
}


