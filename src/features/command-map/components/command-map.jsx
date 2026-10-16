import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { Map as MapLibreMap } from '@/lib/maplibre';

import { useToast } from '@/components/ui/toast/toast-context';

import { useBoundaries } from '../hooks/use-boundaries';
import { useDataStatus } from '../hooks/use-data-status';
import { useWardDetails } from '../hooks/use-ward-details';
import {
  bboxOf,
  distanceToFeatureKm,
  haversineKm,
  normalizeProvinceName,
  pointInFeature,
} from '../utils/geo-math';
import {
  EMPTY_FC,
  LAYERS,
  NATIONAL_VIEW,
  STATIONS_MIN_ZOOM,
  WARD_DETAIL_ZOOM,
  buildBaseStyle,
} from '../utils/map-style';
import { stationMatchesAgency } from '../utils/station-model';
import { GeofenceDock } from './geofence-dock';
import { IncidentMarkers } from './incident-markers';
import { MapControls } from './map-controls';
import { MapStyleSelector } from './map-style-selector';
import styles from './map-view.module.css';
import { StationMarkers, createGpsBeacon } from './station-markers';
import { WardHud } from './ward-hud';

const WARDS_PREF_KEY = 'allWardsVisible';
const EMPTY_INCIDENTS = [];
const WARD_SCOPE_KEY = 'wardGridScope'; // 'focus' = province under the map centre, 'all' = whole country
const COAST_SNAP_KM = 15; // centre this close to a province border still counts as that province
const CITY_PROVINCES = new Set(['hà nội', 'hồ chí minh', 'cần thơ', 'đà nẵng', 'hải phòng', 'huế']);

function readPref(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

const readWardsPref = () => readPref(WARDS_PREF_KEY, 'true') !== 'false';

/**
 * Province whose polygon holds the point. Just outside a polygon (simplified
 * coastline) the province within COAST_SNAP_KM counts; further away - abroad or
 * open sea - there is no focus province and only province-level units show.
 */
function findFocusProvince(provinces, [lng, lat]) {
  if (!provinces) return null;
  const pad = COAST_SNAP_KM / 100; // degrees, rough bbox pre-filter
  let best = null;
  let bestKm = COAST_SNAP_KM;
  for (const p of provinces) {
    const [minX, minY, maxX, maxY] = p.bbox;
    if (lng < minX - pad || lng > maxX + pad || lat < minY - pad || lat > maxY + pad) continue;
    if (pointInFeature([lng, lat], p.feature)) return p;
    const km = distanceToFeatureKm([lng, lat], p.feature);
    if (km <= bestKm) {
      bestKm = km;
      best = p;
    }
  }
  return best;
}

function findWardOf(wards, station) {
  if (!wards) return null;
  return wards.find((w) => pointInFeature([station.lng, station.lat], w.feature)) || null;
}

/**
 * Facilities of a ward for the HUD. With a GPS fix: nearest first, each with distanceKm
 * (legacy "Cơ sở gần nhất"); without: the clicked one, then the main HQ.
 */
function sortFacilities(list, firstId, origin) {
  if (origin) {
    return list
      .map((s) => ({ ...s, distanceKm: haversineKm(origin.lat, origin.lng, s.lat, s.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }
  const isMain = (s) => s.facilityType === 'Trụ sở chính' || /trụ sở chính/i.test(s.name);
  return [...list].sort((a, b) => {
    if (a.id === firstId) return -1;
    if (b.id === firstId) return 1;
    return Number(isMain(b)) - Number(isMain(a));
  });
}

/**
 * Command map: base map "Nền VN 2026", province/ward boundaries and rescue
 * station pins, with the legacy overlays (style menu, compass/zoom, geofence
 * dock, ward HUD).
 *
 * Station pins follow the zoom:
 *   zoom < 5.8         nothing
 *   5.8 – 8.5          province-level units (Công an tỉnh, PC07, PC08, 115...)
 *   >= 8.5             + ward units of ONE province: the one under the map centre
 *                       (or nearest to it). Centre abroad: provinces only.
 * Ward grid: same one-province rule ('focus'), or every ward at any zoom ('all').
 * "Định vị GPS hiện trường": device position + beacon, its ward highlighted, and the
 * fix is the origin of the HUD distances.
 *
 * Imperative API (ref): focusUnit(), flyToStation(station), flyToIncident(incident)
 *
 * @param {{
 *   ref?: React.Ref,
 *   officer: { agency: string, level: string, province: string|null, ward: string|null },
 *   stations: object[],
 *   incidents?: object[],            // active incidents of the officer's queue (SOS pins)
 *   selectedIncidentId?: string|null,
 *   onIncidentClick?: (incident) => void,
 *   onUnitLocated?: (coords: { lat: number, lng: number }) => void,
 * }} props
 */
export function CommandMap({
  ref,
  officer,
  stations,
  incidents = EMPTY_INCIDENTS,
  selectedIncidentId = null,
  onIncidentClick,
  onUnitLocated,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const styleReadyRef = useRef(false);
  const markersRef = useRef(null);
  const incidentMarkersRef = useRef(null);
  const onIncidentClickRef = useRef(onIncidentClick);
  const unitViewRef = useRef(null);
  const gpsMarkerRef = useRef(null);
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState({
    zoom: NATIONAL_VIEW.zoom,
    bearing: 0,
    center: NATIONAL_VIEW.center,
    bounds: null,
  });
  const [layers, setLayers] = useState(() => ({ wards: readWardsPref(), provinces: true, stations: true }));
  const [wardScope, setWardScope] = useState(() =>
    readPref(WARD_SCOPE_KEY, 'focus') === 'all' ? 'all' : 'focus',
  );
  const [gps, setGps] = useState(null); // { lat, lng } after "Định vị GPS hiện trường"
  const [locating, setLocating] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [dockProvince, setDockProvince] = useState('');
  const [dockWard, setDockWard] = useState(null);
  const [wardHighlightVisible, setWardHighlightVisible] = useState(true);
  const [hud, setHud] = useState(null);

  const { provinces, wardsByProvince, ensureWards } = useBoundaries();
  const dataStatus = useDataStatus();
  const lookupWardDetails = useWardDetails();

  const agencyStations = useMemo(
    () => stations.filter((s) => stationMatchesAgency(s, officer.agency)),
    [stations, officer.agency],
  );

  const focusProvince = useMemo(() => findFocusProvince(provinces, view.center), [provinces, view.center]);
  const detailMode = view.zoom >= WARD_DETAIL_ZOOM && Boolean(focusProvince);

  // ---------------------------------------------------------------- map init
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildBaseStyle({ wardsVisible: readWardsPref(), provincesVisible: true }),
      center: NATIONAL_VIEW.center,
      zoom: isMobile ? NATIONAL_VIEW.mobileZoom : NATIONAL_VIEW.zoom,
      pitch: 25,
      attributionControl: false,
    });
    mapRef.current = map;

    const readView = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      setView({
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        center: [c.lng, c.lat],
        bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      });
    };
    map.on('load', () => {
      styleReadyRef.current = true;
      readView();
      setLoaded(true);
    });
    map.on('moveend', readView);
    map.on('rotate', () => setView((v) => ({ ...v, bearing: map.getBearing() })));

    return () => {
      markersRef.current?.clear();
      markersRef.current = null;
      incidentMarkersRef.current?.clear();
      incidentMarkersRef.current = null;
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  // ------------------------------------------------------------ selections
  const highlightProvince = useCallback((name) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const filter = ['==', ['get', 'shapeName'], name || ''];
    LAYERS.provinceHighlight.forEach((id) => map.setFilter(id, filter));
  }, []);

  const highlightWard = useCallback((feature) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    map
      .getSource('ward-boundary')
      ?.setData(feature ? { type: 'FeatureCollection', features: [feature] } : EMPTY_FC);
  }, []);

  /** Legacy fitBounds on the selected ward: the whole polygon in view, clear of the HUD card (left). */
  const fitWard = useCallback((feature) => {
    const map = mapRef.current;
    if (!map || !feature?.geometry) return;
    const [minX, minY, maxX, maxY] = bboxOf(feature);
    if (!Number.isFinite(minX)) return;
    const { width, height } = map.getContainer().getBoundingClientRect();
    const roomy = width > 900 && height > 500; // narrow map (phone, video call): small even padding
    const padding = roomy
      ? { top: 60, bottom: 90, left: 460, right: 60 }
      : { top: 50, bottom: 70, left: 24, right: 24 };
    map.stop();
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding, maxZoom: 14.5, duration: 1000 },
    );
  }, []);

  const showWard = useCallback(
    async (ward, clickedStation = null) => {
      const inWard = agencyStations.filter(
        (s) => s.level === 'ward' && pointInFeature([s.lng, s.lat], ward.feature),
      );
      const facilities = sortFacilities(inWard, clickedStation?.id, gps);
      const station =
        (clickedStation && facilities.find((f) => f.id === clickedStation.id)) || facilities[0] || null;
      highlightProvince('');
      highlightWard(ward.feature);
      setWardHighlightVisible(true);
      const selection = {
        kind: 'ward',
        wardName: ward.name,
        provinceName: ward.province,
        sapNhapTu: null,
        station,
        facilities,
      };
      setHud(selection);
      markersRef.current?.select(station?.id || null);
      const details = await lookupWardDetails(ward.province, ward.name);
      if (details?.sap_nhap_tu) {
        setHud((h) => (h === selection ? { ...h, sapNhapTu: details.sap_nhap_tu } : h));
      }
    },
    [agencyStations, gps, highlightProvince, highlightWard, lookupWardDetails],
  );

  const showStation = useCallback(
    async (station) => {
      markersRef.current?.select(station.id);
      if (station.level !== 'ward') {
        highlightWard(null);
        highlightProvince(
          provinces?.find((p) => p.key === normalizeProvinceName(station.province))?.name || '',
        );
        setHud({ kind: 'province', provinceName: station.province, station, facilities: [] });
        return;
      }
      const index = await ensureWards().catch(() => null);
      const ward = findWardOf(index?.get(normalizeProvinceName(station.province)), station);
      if (ward) {
        fitWard(ward.feature);
        showWard(ward, station);
      } else {
        highlightWard(null);
        setHud({
          kind: 'ward',
          wardName: station.ward,
          provinceName: station.province,
          station,
          facilities: [],
        });
      }
    },
    [ensureWards, fitWard, highlightProvince, highlightWard, provinces, showWard],
  );

  // Marker clicks need the latest showStation without re-creating markers.
  const showStationRef = useRef(showStation);
  useEffect(() => {
    showStationRef.current = showStation;
  }, [showStation]);

  // -------------------------------------------------------- unit camera
  const focusUnit = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (unitViewRef.current) {
      map.flyTo({ ...unitViewRef.current, duration: 1200 });
      return;
    }
    if (officer.level === 'national' || !provinces) {
      const zoom = window.innerWidth <= 768 ? NATIONAL_VIEW.mobileZoom : NATIONAL_VIEW.zoom;
      map.jumpTo({ center: NATIONAL_VIEW.center, zoom, pitch: 0, bearing: 0 });
    }
  }, [officer.level, provinces]);

  useEffect(() => {
    if (!loaded || !provinces) return undefined;
    let cancelled = false;
    const province = provinces.find((p) => p.key === normalizeProvinceName(officer.province));

    (async () => {
      let target = null;
      if (officer.level === 'ward' && province) {
        // Head for the province right away; the ward polygons (6 MB) may take a few seconds.
        mapRef.current?.flyTo({ center: province.center, zoom: 9.5, duration: 1200 });
        const index = await ensureWards().catch(() => null);
        const ward = index
          ?.get(province.key)
          ?.find(
            (w) =>
              w.name.normalize('NFC').toLowerCase() === (officer.ward || '').normalize('NFC').toLowerCase(),
          );
        target = ward ? { center: ward.center, zoom: 13.5 } : { center: province.center, zoom: 9.5 };
      } else if (officer.level === 'province' && province) {
        target = { center: province.center, zoom: 9.5 };
      }
      if (cancelled) return;
      if (target) {
        unitViewRef.current = target;
        mapRef.current?.flyTo({ ...target, duration: 1200 });
        onUnitLocated?.({ lng: target.center[0], lat: target.center[1] });
      } else if (province) {
        // Command centre: national view, weather of its home province.
        onUnitLocated?.({ lng: province.center[0], lat: province.center[1] });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once per officer when the map and provinces are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, provinces, officer.level, officer.province, officer.ward]);

  useImperativeHandle(
    ref,
    () => ({
      focusUnit,
      flyToStation(station) {
        mapRef.current?.flyTo({
          center: [station.lng, station.lat],
          zoom: Math.max(14, view.zoom),
          duration: 900,
        });
        showStation(station);
      },
      flyToIncident(incident) {
        if (incident.lat == null || incident.lng == null) return;
        mapRef.current?.flyTo({ center: [incident.lng, incident.lat], zoom: 15.5, duration: 1200 });
      },
    }),
    [focusUnit, showStation, view.zoom],
  );

  // ------------------------------------------------------- layer toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const vis = (on) => (on ? 'visible' : 'none');
    LAYERS.provinces.forEach((id) => map.setLayoutProperty(id, 'visibility', vis(layers.provinces)));
    LAYERS.wards.forEach((id) => map.setLayoutProperty(id, 'visibility', vis(layers.wards)));
    writePref(WARDS_PREF_KEY, String(layers.wards));
  }, [loaded, layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    LAYERS.wardHighlight.forEach((id) =>
      map.setLayoutProperty(id, 'visibility', wardHighlightVisible ? 'visible' : 'none'),
    );
  }, [loaded, wardHighlightVisible]);

  // Ward grid: 'focus' = wards of the province under the centre when zoomed in; 'all' = every ward.
  const allWardFeatures = useMemo(
    () => (wardsByProvince ? [...wardsByProvince.values()].flat().map((w) => w.feature) : []),
    [wardsByProvince],
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const wantsWards = layers.wards && (wardScope === 'all' || detailMode);
    if (wantsWards && !wardsByProvince) {
      ensureWards().catch(() => {});
      return;
    }
    let features = [];
    if (wantsWards && wardScope === 'all') features = allWardFeatures;
    else if (wantsWards) features = (wardsByProvince.get(focusProvince.key) || []).map((w) => w.feature);
    map.getSource('vn-focus-wards')?.setData({ type: 'FeatureCollection', features });
  }, [
    loaded,
    detailMode,
    focusProvince,
    wardsByProvince,
    allWardFeatures,
    layers.wards,
    wardScope,
    ensureWards,
  ]);

  const changeWardScope = (scope) => {
    setWardScope(scope);
    writePref(WARD_SCOPE_KEY, scope);
  };

  // ----------------------------------------------------------- GPS locate
  const locateGps = () => {
    if (!navigator.geolocation) {
      toast.show('Thiết bị không hỗ trợ định vị GPS', { tone: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(point);
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({ center: [point.lng, point.lat], zoom: 15.5, pitch: 25, duration: 1200 });

        const province = findFocusProvince(provinces, [point.lng, point.lat]);
        const index = province ? await ensureWards().catch(() => null) : null;
        const ward = province ? findWardOf(index?.get(province.key), point) : null;

        gpsMarkerRef.current?.remove();
        gpsMarkerRef.current = createGpsBeacon(map, point, ward?.name || 'VỊ TRÍ CỦA BẠN');
        if (!province) {
          toast.show('Vị trí hiện tại nằm ngoài địa giới Việt Nam', { tone: 'info' });
          return;
        }
        // Legacy: highlight the ward of the fix, unless a ward was picked by hand.
        if (ward && !dockWard) {
          setDockProvince(ward.province);
          highlightProvince('');
          highlightWard(ward.feature);
          setWardHighlightVisible(true);
        }
      },
      (err) => {
        setLocating(false);
        const reason =
          err.code === err.PERMISSION_DENIED
            ? 'Trình duyệt chưa cho phép truy cập vị trí'
            : 'Không lấy được tín hiệu GPS';
        toast.show(`${reason}. Thử lại sau.`, { tone: 'error' });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  // -------------------------------------------------------- station pins
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    if (!markersRef.current) markersRef.current = new StationMarkers(map, (st) => showStationRef.current(st));

    if (!layers.stations || view.zoom < STATIONS_MIN_ZOOM || !view.bounds) {
      markersRef.current.sync([]);
      return;
    }
    const [w, s, e, n] = view.bounds;
    const padX = (e - w) * 0.1;
    const padY = (n - s) * 0.1;
    const visible = agencyStations.filter((st) => {
      if (st.lng < w - padX || st.lng > e + padX || st.lat < s - padY || st.lat > n + padY) return false;
      if (st.level !== 'ward') return true;
      return detailMode && normalizeProvinceName(st.province) === focusProvince.key;
    });
    markersRef.current.sync(visible);
  }, [loaded, layers.stations, view, agencyStations, detailMode, focusProvince]);

  // ------------------------------------------------------- incident pins
  useEffect(() => {
    onIncidentClickRef.current = onIncidentClick;
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    if (!incidentMarkersRef.current) {
      incidentMarkersRef.current = new IncidentMarkers(map, (inc) => onIncidentClickRef.current?.(inc));
    }
    incidentMarkersRef.current.sync(incidents);
  }, [loaded, incidents]);

  useEffect(() => {
    incidentMarkersRef.current?.select(selectedIncidentId);
  }, [selectedIncidentId, incidents]);

  // --------------------------------------------------------- dock actions
  const selectProvince = (name) => {
    const p = provinces?.find((x) => x.name === name);
    setDockProvince(name);
    setDockWard(null);
    setHud(null);
    highlightWard(null);
    highlightProvince(name);
    if (p)
      mapRef.current?.flyTo({ center: p.center, zoom: CITY_PROVINCES.has(p.key) ? 12 : 11, duration: 1200 });
  };

  const selectWard = (ward) => {
    setDockProvince(ward.province);
    setDockWard(ward);
    fitWard(ward.feature);
    showWard(ward);
  };

  const clearSelection = () => {
    setDockProvince('');
    setDockWard(null);
    setHud(null);
    highlightWard(null);
    highlightProvince('');
    markersRef.current?.select(null);
  };

  const toggleAreaGrid = () => {
    if (dockWard || hud?.kind === 'ward') setWardHighlightVisible((v) => !v);
    else setLayers((l) => ({ ...l, provinces: !l.provinces }));
  };

  const closeHud = () => {
    setHud(null);
    markersRef.current?.select(null);
  };

  const areaGridVisible = dockWard || hud?.kind === 'ward' ? wardHighlightVisible : layers.provinces;

  return (
    <>
      <MapStyleSelector
        open={styleOpen}
        onToggle={() => setStyleOpen((o) => !o)}
        onClose={() => setStyleOpen(false)}
        layers={layers}
        onToggleLayer={(key) => setLayers((l) => ({ ...l, [key]: !l[key] }))}
        wardScope={wardScope}
        onWardScopeChange={changeWardScope}
        dataStatus={dataStatus}
        locating={locating}
        onLocateGps={() => {
          setStyleOpen(false);
          locateGps();
        }}
      />

      <MapControls
        bearing={view.bearing}
        onResetNorth={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 600 })}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
      />

      {!styleOpen && (
        <GeofenceDock
          provinces={provinces}
          wardsByProvince={wardsByProvince}
          ensureWards={ensureWards}
          stations={stations}
          selectedProvince={dockProvince}
          selectedWard={dockWard}
          areaGridVisible={areaGridVisible}
          onSelectProvince={selectProvince}
          onSelectWard={selectWard}
          onToggleAreaGrid={toggleAreaGrid}
          onClear={clearSelection}
        />
      )}

      {hud && (
        <WardHud
          key={`${hud.kind}-${hud.wardName || hud.provinceName}-${hud.station?.id || ''}`}
          selection={hud}
          origin={gps}
          onPickFacility={(st) => {
            markersRef.current?.select(st.id);
            mapRef.current?.flyTo({ center: [st.lng, st.lat], zoom: 16, duration: 800 });
          }}
          onClose={closeHud}
        />
      )}

      <div ref={containerRef} className={styles.dispatcherMap} />
    </>
  );
}
