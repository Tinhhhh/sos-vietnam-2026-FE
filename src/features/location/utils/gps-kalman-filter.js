/**
 * 2-axis linear Kalman filter for GPS smoothing (port of legacy location.js).
 * Measurement noise comes from position.coords.accuracy, process noise from
 * an assumed walking speed of ~1.5 m/s.
 */
const METERS_PER_DEG_LAT = 111320;
const WALKING_SPEED_MPS = 1.5;

const metersPerDegLng = (lat) => METERS_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.1);

export class GpsKalmanFilter {
  constructor(lat, lng, accuracy = 30) {
    const acc = Math.max(accuracy, 1);
    this.lat = lat;
    this.lng = lng;
    this.varianceLat = (acc / METERS_PER_DEG_LAT) ** 2;
    this.varianceLng = (acc / metersPerDegLng(lat)) ** 2;
    this.lastTimestamp = Date.now();
  }

  /** @param {{lat:number, lng:number, accuracy:number, timestamp?:number}} fix */
  update(fix) {
    const now = fix.timestamp || Date.now();
    const dt = Math.max((now - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = now;

    const lngScale = metersPerDegLng(fix.lat);

    // Predict: variance grows with how far the user could have moved.
    const qMeters = (WALKING_SPEED_MPS * dt) ** 2;
    const predVarLat = this.varianceLat + qMeters / METERS_PER_DEG_LAT ** 2;
    const predVarLng = this.varianceLng + qMeters / lngScale ** 2;

    // Measurement noise from the reported 1-sigma accuracy.
    const rAcc = Math.max(fix.accuracy || 20, 2);
    const rLat = (rAcc / METERS_PER_DEG_LAT) ** 2;
    const rLng = (rAcc / lngScale) ** 2;

    const kLat = predVarLat / (predVarLat + rLat);
    const kLng = predVarLng / (predVarLng + rLng);

    this.lat += kLat * (fix.lat - this.lat);
    this.lng += kLng * (fix.lng - this.lng);
    this.varianceLat = (1 - kLat) * predVarLat;
    this.varianceLng = (1 - kLng) * predVarLng;

    return {
      lat: Number(this.lat.toFixed(7)),
      lng: Number(this.lng.toFixed(7)),
      accuracy: Math.max(Math.round(Math.sqrt(this.varianceLat) * METERS_PER_DEG_LAT), 3),
    };
  }
}

/** Haversine distance in meters. */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
