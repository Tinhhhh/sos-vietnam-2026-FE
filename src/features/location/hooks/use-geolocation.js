import { useCallback, useEffect, useRef, useState } from 'react';

import { getIpLocation, getReverseGeocode, resolveJurisdiction } from '../api/geocode';
import { distanceMeters, GpsKalmanFilter } from '../utils/gps-kalman-filter';

const REFINE_WINDOW_MS = 20000;
const GOOD_ACCURACY_M = 15;
const REGEOCODE_MIN_MOVE_M = 25;

const coordsLabel = ({ lat, lng }) => `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
const isPlaceholderAddress = (addr) => !addr || /^Tọa độ:/i.test(addr);

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

async function addressFor(coords) {
  try {
    return (await getReverseGeocode(coords)) || coordsLabel(coords);
  } catch {
    return coordsLabel(coords);
  }
}

/**
 * Citizen position: one high-accuracy fix, then 20 s of Kalman-smoothed
 * refinement, then the ward/province lookup. Port of legacy LocationService.
 *
 * status: 'locating' | 'gps' | 'ip' | 'manual' (picked on the map) | 'unavailable'
 * permissionDenied: the citizen refused location for this site (the browser will not ask again by itself:
 * it has to be turned on in the browser / phone settings; a change there is picked up at once)
 * When neither GPS nor the IP lookup works there is NO position (coords null): an SOS must
 * never go out with a made-up location. The citizen turns location on (refresh) or picks the
 * spot on the map (setManual). `hasFix` says whether coords can be sent.
 */
export function useGeolocation() {
  const [state, setState] = useState({
    status: 'locating',
    coords: null,
    accuracy: null,
    address: '',
    jurisdiction: null,
    permissionDenied: false,
  });

  const runIdRef = useRef(0);
  const watchIdRef = useRef(null);
  const watchTimerRef = useRef(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
    clearTimeout(watchTimerRef.current);
    watchIdRef.current = null;
  }, []);

  // Never sets state before its first await, so it is safe to start from an effect.
  // Resolves with the first fix ({ status: 'gps' | 'ip' | 'unavailable', accuracy }), or null when a newer run replaced it.
  const locate = useCallback(async () => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runId === runIdRef.current;
    stopWatching();

    let fix = null;
    let permissionDenied = false;
    if (navigator.geolocation) {
      try {
        const pos = await getCurrentPosition();
        fix = {
          status: 'gps',
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: Math.round(pos.coords.accuracy || 10),
        };
      } catch (err) {
        // denied / timeout -> IP fallback below
        permissionDenied = err?.code === 1; // PERMISSION_DENIED
      }
    }
    if (!isCurrent()) return null;

    if (fix) {
      fix.address = await addressFor(fix.coords);
    } else {
      const ip = await getIpLocation().catch(() => null);
      if (!ip) {
        if (isCurrent()) {
          setState((s) => ({
            ...s,
            status: 'unavailable',
            coords: null,
            accuracy: null,
            address: '',
            jurisdiction: null,
            permissionDenied,
          }));
          return { status: 'unavailable', accuracy: null, permissionDenied };
        }
        return null;
      }
      fix = { status: 'ip', coords: ip.coords, accuracy: 500, address: ip.address };
    }
    if (!isCurrent()) return null;
    fix.permissionDenied = permissionDenied;
    setState({ ...fix, jurisdiction: null });

    // Ward/province that contains the point. The polygon is the source of
    // truth for "where am I", so it also replaces a bare-coordinates address.
    resolveJurisdiction(fix.coords)
      .then((area) => {
        if (!isCurrent() || !area) return;
        const areaLabel = [area.ward, area.province].filter(Boolean).join(', ');
        setState((s) => ({
          ...s,
          jurisdiction: { ...area, label: areaLabel },
          address: isPlaceholderAddress(s.address) ? areaLabel : s.address,
        }));
      })
      .catch(() => {});

    if (fix.status !== 'gps') return fix;

    // Refine with watchPosition + Kalman filter until accurate enough or 20 s.
    const kalman = new GpsKalmanFilter(fix.coords.lat, fix.coords.lng, fix.accuracy);
    let lastGeocoded = fix.coords;
    watchTimerRef.current = setTimeout(stopWatching, REFINE_WINDOW_MS);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        if (!isCurrent()) return;
        const filtered = kalman.update({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 30),
          timestamp: pos.timestamp,
        });
        const coords = { lat: filtered.lat, lng: filtered.lng };
        if (filtered.accuracy <= GOOD_ACCURACY_M) stopWatching();

        let address;
        if (distanceMeters(lastGeocoded, coords) >= REGEOCODE_MIN_MOVE_M) {
          lastGeocoded = coords;
          address = await addressFor(coords);
          if (!isCurrent()) return;
        }
        setState((s) => ({
          ...s,
          coords,
          accuracy: filtered.accuracy,
          address: address && !(s.jurisdiction && isPlaceholderAddress(address)) ? address : s.address,
        }));
      },
      stopWatching,
      { enableHighAccuracy: true, timeout: REFINE_WINDOW_MS, maximumAge: 0 },
    );
    return fix;
  }, [stopWatching]);

  /** Position chosen by the citizen on the map (GPS / IP unavailable or wrong). */
  const setManual = useCallback(
    async (coords) => {
      const runId = ++runIdRef.current;
      stopWatching();
      setState({
        status: 'manual',
        coords,
        accuracy: null,
        address: coordsLabel(coords),
        jurisdiction: null,
      });
      const area = await resolveJurisdiction(coords).catch(() => null);
      if (runId !== runIdRef.current || !area) return;
      const label = [area.ward, area.province].filter(Boolean).join(', ');
      setState((s) => ({ ...s, jurisdiction: { ...area, label }, address: label || s.address }));
    },
    [stopWatching],
  );

  /** Locate again; resolves like locate() so a button can say how it went. */
  const refresh = useCallback(() => {
    setState((s) => ({ ...s, status: 'locating', jurisdiction: null }));
    return locate();
  }, [locate]);

  useEffect(() => {
    locate();
    return () => {
      runIdRef.current += 1;
      stopWatching();
    };
  }, [locate, stopWatching]);

  // turned on / off in the browser settings while the page is open: locate again at once
  useEffect(() => {
    let status = null;
    let alive = true;
    const onChange = () => {
      if (status?.state === 'granted') locate();
      else if (status?.state === 'denied') setState((s) => ({ ...s, permissionDenied: true }));
    };
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((st) => {
        if (!alive) return;
        status = st;
        st.addEventListener('change', onChange);
      })
      .catch(() => {});
    return () => {
      alive = false;
      status?.removeEventListener('change', onChange);
    };
  }, [locate]);

  const hasFix = !!state.coords && state.status !== 'unavailable';
  return { ...state, hasFix, refresh, setManual };
}
