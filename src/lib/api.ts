import type { Photo, PlaceResult, Spot, SpotFilter, SpotInput, SpotSummary } from '../../shared/types';
import type { LatLng } from './geo';

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'ApiError';
  }
}

async function fail(res: Response): Promise<never> {
  let code = `http_${res.status}`;
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string') code = body.error;
  } catch {
    // body is not JSON; keep the fallback code
  }
  throw new ApiError(res.status, code);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) return fail(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  listSpots(f: SpotFilter): Promise<SpotSummary[]> {
    const qs = new URLSearchParams();
    if (f.status) qs.set('status', f.status);
    if (f.tag) qs.set('tag', f.tag);
    const s = qs.toString();
    return request(`/api/spots${s ? `?${s}` : ''}`);
  },
  async getSpot(id: string): Promise<Spot | null> {
    try {
      return await request<Spot>(`/api/spots/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  listTags(): Promise<string[]> {
    return request('/api/tags');
  },
  createSpot(i: SpotInput): Promise<Spot> {
    return request('/api/admin/spots', jsonInit('POST', i));
  },
  updateSpot(id: string, i: SpotInput): Promise<Spot> {
    return request(`/api/admin/spots/${encodeURIComponent(id)}`, jsonInit('PUT', i));
  },
  deleteSpot(id: string): Promise<void> {
    return request(`/api/admin/spots/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  uploadPhoto(spotId: string, blob: Blob, w: number, h: number): Promise<Photo> {
    return request(`/api/admin/spots/${encodeURIComponent(spotId)}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type, 'X-Photo-Width': String(w), 'X-Photo-Height': String(h) },
      body: blob,
    });
  },
  deletePhoto(id: string): Promise<void> {
    return request(`/api/admin/photos/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  searchPlaces(q: string, near: LatLng): Promise<PlaceResult[]> {
    const qs = new URLSearchParams({ q, lat: String(near.lat), lng: String(near.lng) });
    return request(`/api/admin/search?${qs}`);
  },
  async me(): Promise<{ email: string } | null> {
    try {
      const res = await fetch('/api/admin/me', { redirect: 'manual' });
      if (res.type === 'opaqueredirect' || res.status !== 200) return null;
      return (await res.json()) as { email: string };
    } catch {
      return null;
    }
  },
};
