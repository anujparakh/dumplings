import { env } from 'cloudflare:workers';
import { expect, test, vi } from 'vitest';
import { createApp } from '../../server/app';
import type { Env } from '../../server/env';
import { searchPlaces } from '../../server/search';
import { fakeVerifier } from './helpers';

const photonEnv = { SEARCH_PROVIDER: 'photon' } as Env;
const googleEnv = { SEARCH_PROVIDER: 'google', GOOGLE_PLACES_KEY: 'secret-key' } as Env;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const stub = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => json(body, status));

const feature = (properties: Record<string, unknown>, coordinates = [-95.37, 29.76]) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates }, properties,
});

test('q shorter than settings.searchMinChars returns [] without calling fetch', async () => {
  const f = stub({ features: [] });
  expect(await searchPlaces('ab', null, photonEnv, f)).toEqual([]);
  expect(f).not.toHaveBeenCalled();
});

test('photon response maps to PlaceResult with joined address', async () => {
  const f = stub({
    features: [feature({ name: 'Golden Steamer', housenumber: '123', street: 'Main St', city: 'Houston', state: 'Texas' })],
  });
  expect(await searchPlaces('golden', null, photonEnv, f)).toEqual([
    { name: 'Golden Steamer', address: '123 Main St, Houston, Texas', lat: 29.76, lng: -95.37 },
  ]);
  const [url, init] = f.mock.calls[0];
  const u = new URL(String(url));
  expect(u.origin + u.pathname).toBe('https://photon.komoot.io/api/');
  expect(u.searchParams.get('q')).toBe('golden');
  expect(u.searchParams.get('limit')).toBe('8');
  expect((init?.headers as Record<string, string>)['User-Agent']).toBe('dumplings-map');
});

test('photon feature without street/city -> address null', async () => {
  const f = stub({ features: [feature({ name: 'Mystery Place' })] });
  const [r] = await searchPlaces('mystery', null, photonEnv, f);
  expect(r.address).toBeNull();
});

test('lat/lng passed through as location bias', async () => {
  const f = stub({ features: [] });
  await searchPlaces('dumpling', { lat: 29.7, lng: -95.4 }, photonEnv, f);
  const u = new URL(String(f.mock.calls[0][0]));
  expect(u.searchParams.get('lat')).toBe('29.7');
  expect(u.searchParams.get('lon')).toBe('-95.4');

  const g = stub({ places: [] });
  await searchPlaces('dumpling', { lat: 29.7, lng: -95.4 }, googleEnv, g);
  const body = JSON.parse(String(g.mock.calls[0][1]?.body));
  expect(body.locationBias.circle.center).toEqual({ latitude: 29.7, longitude: -95.4 });

  const none = stub({ features: [] });
  await searchPlaces('dumpling', null, photonEnv, none);
  const nu = new URL(String(none.mock.calls[0][0]));
  expect(nu.searchParams.has('lat')).toBe(false);
});

test('SEARCH_PROVIDER=google calls Places Text Search with the key header', async () => {
  const f = stub({
    places: [{ displayName: { text: 'Dumpling Lab' }, formattedAddress: '1 A St', location: { latitude: 1.5, longitude: 2.5 } }],
  });
  const r = await searchPlaces('dumpling', null, googleEnv, f);
  expect(r).toEqual([{ name: 'Dumpling Lab', address: '1 A St', lat: 1.5, lng: 2.5 }]);
  const [url, init] = f.mock.calls[0];
  expect(String(url)).toBe('https://places.googleapis.com/v1/places:searchText');
  expect(init?.method).toBe('POST');
  const h = init?.headers as Record<string, string>;
  expect(h['X-Goog-Api-Key']).toBe('secret-key');
  expect(h['X-Goog-FieldMask']).toBe('places.displayName,places.formattedAddress,places.location');
  expect(JSON.parse(String(init?.body)).locationBias).toBeUndefined();
});

const call = (f: typeof fetch, qs: string, e: object = env) =>
  createApp({ verifyAccessJwt: fakeVerifier('ruchi@example.com'), fetch: f }).request(
    `/api/admin/search?${qs}`, { headers: { 'Cf-Access-Jwt-Assertion': 'test' } }, e);

test('provider HTTP error -> route returns 502 { error: "search_failed" }', async () => {
  const r = await call(stub({}, 500), 'q=dumpling');
  expect(r.status).toBe(502);
  expect(await r.json()).toEqual({ error: 'search_failed' });
});

test('google without a key -> 502 search_failed', async () => {
  const r = await call(stub({}), 'q=dumpling', { ...env, SEARCH_PROVIDER: 'google', GOOGLE_PLACES_KEY: undefined });
  expect(r.status).toBe(502);
});

test('route: short q returns []; partial or bad lat/lng ignores bias; requires auth', async () => {
  const f = stub({ features: [] });
  const short = await call(f, 'q=ab');
  expect(await short.json()).toEqual([]);
  expect(f).not.toHaveBeenCalled();

  await call(f, 'q=dumpling&lat=29.7');
  await call(f, 'q=dumpling&lat=abc&lng=1');
  for (const [url] of f.mock.calls) expect(new URL(String(url)).searchParams.has('lat')).toBe(false);

  await call(f, 'q=dumpling&lat=29.7&lng=-95.4');
  expect(new URL(String(f.mock.calls[2][0])).searchParams.get('lon')).toBe('-95.4');

  const anon = await createApp({ verifyAccessJwt: fakeVerifier('x@example.com'), fetch: f })
    .request('/api/admin/search?q=dumpling', {}, env);
  expect(anon.status).toBe(401);
});
