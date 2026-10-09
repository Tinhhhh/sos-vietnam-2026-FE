import { useCallback, useEffect, useRef, useState } from 'react';

import { getIpLocation, getReverseGeocode, resolveJurisdiction } from '../api/geocode';
import { distanceMeters, GpsKalmanFilter } from '../utils/gps-kalman-filter';

const HANOI_CENTER = { lat: 21.0285, lng: 105.8542 };
// Legacy last-resort position when both GPS and IP lookup fail.
const LEGACY_FALLBACK = { lat: 10.0465, lng: 105.7865 };
const LEGACY_FALLBACK_ADDRESS = 'Quận Ninh Kiều, TP. Cần Thơ, Việt Nam';

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
 * status: 'locating' | 'gps' | 'ip' | 'fallback'
 */
export function useGeolocation() {
  const [state, setState] = useState({
    status: 'locating',
    coords: HANOI_CENTER,
    accuracy: null,
    address: '',
    jurisdiction: null,
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
  const locate = useCallback(async () => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runId === runIdRef.current;
    stopWatching();

    let fix = null;
    if (navigator.geolocation) {
      try {
        const pos = await getCurrentPosition();
        fix = {
          status: 'gps',
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: Math.round(pos.coords.accuracy || 10),
        };
      } catch {
        // denied / timeout -> IP fallback below
      }
    }
    if (!isCurrent()) return;

    if (fix) {
      fix.address = await addressFor(fix.coords);
    } else {
      const ip = await getIpLocation().catch(() => null);
      fix = ip
        ? { status: 'ip', coords: ip.coords, accuracy: 500, address: ip.address }
        : { status: 'fallback', coords: LEGACY_FALLBACK, accuracy: null, address: LEGACY_FALLBACK_ADDRESS };
    }
    if (!isCurrent()) return;
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

    if (fix.status !== 'gps') return;

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
  }, [stopWatching]);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, status: 'locating', jurisdiction: null }));
    locate();
  }, [locate]);

  useEffect(() => {
    locate();
    return () => {
      runIdRef.current += 1;
      stopWatching();
    };
  }, [locate, stopWatching]);

  return { ...state, refresh };
}
