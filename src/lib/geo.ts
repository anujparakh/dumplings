import { text } from '../config/text';

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_MILES = 3958.8;
const WHOLE_MILES_FROM = 10;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function distanceMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

export function formatDistance(miles: number | null): string {
  if (miles === null) return '';
  const n = miles < WHOLE_MILES_FROM ? miles.toFixed(1) : String(Math.round(miles));
  return `${n} ${text.units.miles}`;
}
