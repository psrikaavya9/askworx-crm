/**
 * geo.ts — Shared geographic utilities
 *
 * Single source of truth for the Haversine distance formula used across
 * expense GPS validation, field-visit proximity checks, and any future
 * location-aware features.
 */

const EARTH_RADIUS_M = 6_371_000; // metres

/**
 * Returns the great-circle distance in metres between two WGS-84 coordinates.
 *
 * Uses the Haversine formula — accurate to within ~0.3 % for distances up to
 * a few hundred kilometres, which is more than sufficient for on-site checks.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}
