import { useEffect, useRef } from 'react';

import { LngLatBounds, Map, Marker } from '@/lib/maplibre';

import { STATION_ICON } from '../utils/origin-candidates';
import { locateOnRoute, splitRoute } from '../utils/route-progress';
import styles from './dispatch.module.css';

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

function stationEl(agency) {
  const el = document.createElement('div');
  el.className = styles.stationPin;
  const img = document.createElement('img');
  img.src = STATION_ICON[agency] || STATION_ICON.police;
  img.alt = '';
  el.appendChild(img);
  return el;
}

function sosEl() {
  const el = document.createElement('div');
  el.className = styles.sosPin;
  el.innerHTML = '<span></span><b>SOS</b>';
  return el;
}

/** Where the citizen really is, when the vehicle stops elsewhere (big road outside an alley). */
function citizenEl() {
  const el = document.createElement('div');
  el.className = styles.citizenPin;
  el.title = 'Vị trí người báo tin';
  return el;
}

const EMPTY = { type: 'FeatureCollection', features: [] };
// the plan is fetched again every 5 s and its polyline decoded into a new array: compare routes by content
const routeKey = (c) => (c && c.length > 1 ? `${c.length}|${c[0]}|${c[c.length - 1]}` : '');
const lineOf = (coords) =>
  coords && coords.length > 1
    ? {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} },
        ],
      }
    : EMPTY;

/** Moving field officer: blue dot with a heading arrow (rotated by setRotation, not CSS). */
function vehicleEl() {
  const el = document.createElement('div');
  el.className = styles.vehiclePin;
  el.innerHTML = '<i></i><span></span>';
  return el;
}

/**
 * Map of one dispatch: the station (its own emblem), the SOS point and the road route between
 * them (green line like a ride-hailing app). Fits both points whenever they change.
 * `vehicle` (live GPS of the field officer) only moves its marker: the view is not re-fitted on every point.
 * The part of the route already driven turns grey (only forward: GPS noise never "un-drives" it).
 * `citizen`: the reporter's own position when the destination is a stop point elsewhere (big road outside an
 * alley); shown as a small orange dot joined to the stop point by a dashed walking line.
 *
 * The map follows its box: when the box changes size (modal animation, phone rotation, bottom sheet)
 * it redraws and fits the route again, so tiles never stay stretched.
 *
 * @param {{ origin?: {lat,lng,agency}|null, destination?: {lat,lng}|null, coords?: number[][]|null,
 *           vehicle?: {lat,lng,heading?,stale?}|null, citizen?: {lat,lng}|null,
 *           className?: string, padding?: number | object }} props  className replaces the default fixed height
 */
export function RouteMap({
  origin,
  destination,
  coords,
  vehicle = null,
  citizen = null,
  className,
  padding = 48,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ origin: null, dest: null, vehicle: null, citizen: null });
  const progressRef = useRef(null); // { key, at }: furthest point reached on the current route
  const boundsRef = useRef(null); // last fitted area, re-fitted after a resize
  const paddingRef = useRef(padding);
  useEffect(() => {
    paddingRef.current = padding;
  }, [padding]);

  useEffect(() => {
    const map = new Map({
      container: containerRef.current,
      style: STYLE,
      center: [105.78, 10.03],
      zoom: 11,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on('load', () => {
      map.addSource('walk', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'walk-line',
        type: 'line',
        source: 'walk',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#f97316', 'line-width': 3, 'line-dasharray': [1, 2] },
      });
      map.addSource('route-done', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'route-done-line',
        type: 'line',
        source: 'route-done',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#9ca3af', 'line-width': 6, 'line-opacity': 0.9 },
      });
      map.addSource('route', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#065f46', 'line-width': 9, 'line-opacity': 0.55 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#22c55e', 'line-width': 5 },
      });
      map.fire('route-ready');
    });
    const markers = markersRef.current;
    return () => {
      markers.origin = null;
      markers.dest = null;
      markers.vehicle = null;
      markers.citizen = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const cLat = citizen?.lat;
  const cLng = citizen?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const markers = markersRef.current;

    markers.origin?.remove();
    markers.origin = origin
      ? new Marker({ element: stationEl(origin.agency), anchor: 'center' })
          .setLngLat([origin.lng, origin.lat])
          .addTo(map)
      : null;
    markers.dest?.remove();
    markers.dest = destination
      ? new Marker({ element: sosEl(), anchor: 'bottom' })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map)
      : null;

    // citizen away from the stop point (> 10 m): small dot + dashed walking line
    const away =
      cLat != null &&
      !!destination &&
      Math.hypot(cLat - destination.lat, (cLng - destination.lng) * Math.cos((cLat * Math.PI) / 180)) *
        111_320 >
        10;
    markers.citizen?.remove();
    markers.citizen = away
      ? new Marker({ element: citizenEl(), anchor: 'center' }).setLngLat([cLng, cLat]).addTo(map)
      : null;

    const draw = () => {
      // a new route starts undriven; the vehicle effect below greys out what is behind it
      const progress = progressRef.current?.key === routeKey(coords) ? progressRef.current : null;
      const { done, rest } = splitRoute(coords, progress?.at);
      map.getSource('route')?.setData(lineOf(rest));
      map.getSource('route-done')?.setData(lineOf(done));
      map.getSource('walk')?.setData(
        away
          ? lineOf([
              [destination.lng, destination.lat],
              [cLng, cLat],
            ])
          : EMPTY,
      );
      const pts = [
        ...(coords || []),
        origin && [origin.lng, origin.lat],
        destination && [destination.lng, destination.lat],
        away && [cLng, cLat],
      ].filter(Boolean);
      if (pts.length === 1) {
        boundsRef.current = null;
        map.jumpTo({ center: pts[0], zoom: 15 });
      }
      if (pts.length > 1) {
        const b = pts.reduce((acc, p) => acc.extend(p), new LngLatBounds(pts[0], pts[0]));
        boundsRef.current = b;
        map.fitBounds(b, { padding: paddingRef.current, maxZoom: 16, duration: 600 });
      }
    };
    if (map.getSource('route')) draw();
    else map.once('route-ready', draw);
    return () => map.off('route-ready', draw);
  }, [origin, destination, coords, cLat, cLng]);

  const vLat = vehicle?.lat;
  const vLng = vehicle?.lng;
  const vHeading = vehicle?.heading;
  const vStale = !!vehicle?.stale;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    if (vLat == null || vLng == null) {
      markers.vehicle?.remove();
      markers.vehicle = null;
      return;
    }
    if (!markers.vehicle) {
      markers.vehicle = new Marker({ element: vehicleEl(), anchor: 'center', rotationAlignment: 'map' })
        .setLngLat([vLng, vLat])
        .addTo(map);
    } else {
      markers.vehicle.setLngLat([vLng, vLat]);
    }
    markers.vehicle.setRotation(vHeading ?? 0);
    markers.vehicle.getElement().classList.toggle(styles.vehicleStale, vStale);
    markers.vehicle.getElement().classList.toggle(styles.vehicleNoHeading, vHeading == null);

    // grey out the driven part: only move forward along this route
    if (!coords || coords.length < 2) return;
    const prev = progressRef.current?.key === routeKey(coords) ? progressRef.current.at : null;
    const at = locateOnRoute(coords, { lat: vLat, lng: vLng }, { fromIndex: prev?.index ?? 0 });
    if (!at) return;
    progressRef.current = { key: routeKey(coords), at };
    const { done, rest } = splitRoute(coords, at);
    map.getSource('route')?.setData(lineOf(rest));
    map.getSource('route-done')?.setData(lineOf(done));
  }, [vLat, vLng, vHeading, vStale, coords]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const map = mapRef.current;
        if (!map) return;
        map.resize();
        if (boundsRef.current) {
          map.fitBounds(boundsRef.current, { padding: paddingRef.current, maxZoom: 16, duration: 0 });
        }
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <div ref={containerRef} className={className || styles.map} />;
}
