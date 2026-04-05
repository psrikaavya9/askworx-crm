/**
 * Geo-fence utility for office attendance check-in.
 *
 * Usage:
 *   const result = await getGeoLocation();
 *   if (!result.isWithinRange) { // block check-in }
 */

// ---------------------------------------------------------------------------
// Office coordinates — update to your actual office location
// ---------------------------------------------------------------------------
const OFFICE_LAT     = 28.6139;  // e.g. New Delhi — replace with real coords
const OFFICE_LNG     = 77.2090;
const RADIUS_METERS  = 100;      // allowed radius in metres

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------
export interface GeoResult {
  latitude:      number;
  longitude:     number;
  distance:      number;   // metres from office coordinates
  isWithinRange: boolean;
}

// ---------------------------------------------------------------------------
// Haversine formula — great-circle distance between two lat/lng points
// ---------------------------------------------------------------------------
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R  = 6_371_000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// checkGeoFence — pure function, accepts pre-fetched coordinates
// ---------------------------------------------------------------------------
export function checkGeoFence(latitude: number, longitude: number): GeoResult {
  const distance = Math.round(
    haversineDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG)
  );
  return {
    latitude,
    longitude,
    distance,
    isWithinRange: distance <= RADIUS_METERS,
  };
}

// ---------------------------------------------------------------------------
// getGeoLocation — requests GPS, then runs geo-fence check
// ---------------------------------------------------------------------------
export function getGeoLocation(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve(checkGeoFence(pos.coords.latitude, pos.coords.longitude));
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable GPS access and try again."
            : "Could not get location. Check browser permissions.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
