import type { PlaceResult } from '../shared/types';
import { settings } from '../src/config/settings';
import type { Env } from './env';

type Near = { lat: number; lng: number } | null;

const BIAS_RADIUS_METERS = 50000;
const RESULT_LIMIT = 8;

export async function photonSearch(q: string, near: Near, fetchFn: typeof fetch): Promise<PlaceResult[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(RESULT_LIMIT));
  if (near) {
    url.searchParams.set('lat', String(near.lat));
    url.searchParams.set('lon', String(near.lng));
  }
  const res = await fetchFn(url.toString(), { headers: { 'User-Agent': 'dumplings-map' } });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const data = (await res.json()) as {
    features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[];
  };
  return (data.features ?? []).map(({ geometry, properties: p }) => {
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const address = [street, p.city, p.state].filter(Boolean).join(', ');
    return {
      name: p.name ?? '',
      address: address || null,
      lat: geometry.coordinates[1],
      lng: geometry.coordinates[0],
    };
  });
}

export async function googleSearch(q: string, near: Near, key: string, fetchFn: typeof fetch): Promise<PlaceResult[]> {
  const body: Record<string, unknown> = { textQuery: q, pageSize: RESULT_LIMIT };
  if (near) {
    body.locationBias = {
      circle: { center: { latitude: near.lat, longitude: near.lng }, radius: BIAS_RADIUS_METERS },
    };
  }
  const res = await fetchFn('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = (await res.json()) as {
    places?: { displayName?: { text?: string }; formattedAddress?: string; location: { latitude: number; longitude: number } }[];
  };
  return (data.places ?? []).map((p) => ({
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? null,
    lat: p.location.latitude,
    lng: p.location.longitude,
  }));
}

export async function searchPlaces(q: string, near: Near, env: Env, fetchFn: typeof fetch): Promise<PlaceResult[]> {
  if (q.trim().length < settings.searchMinChars) return [];
  if (env.SEARCH_PROVIDER === 'google') {
    if (!env.GOOGLE_PLACES_KEY) throw new Error('GOOGLE_PLACES_KEY not configured');
    return googleSearch(q, near, env.GOOGLE_PLACES_KEY, fetchFn);
  }
  return photonSearch(q, near, fetchFn);
}
