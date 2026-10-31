import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';
import { createApp } from '../../server/app';
import { settings } from '../../src/config/settings';
import { fakeVerifier } from './helpers';

const app = createApp({ verifyAccessJwt: fakeVerifier('ruchi@example.com') });
const auth = { 'Cf-Access-Jwt-Assertion': 'test' };

const been = { name: 'Golden Steamer', address: '123 Main St', lat: 29.76, lng: -95.37,
  status: 'been', rating: 4, notes: 'Crispy', visitedOn: '2026-10-12', tags: ['Dumplings'] };
const want = { ...been, name: 'Dumpling Lab', status: 'want', rating: null, visitedOn: null };

const createSpot = async (input: unknown) => {
  const r = await app.request('/api/admin/spots', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }, env);
  return ((await r.json()) as { id: string }).id;
};
const bytes = (n = 8) => new Uint8Array(n).fill(7);
const upload = (spotId: string, opts: {
  type?: string; width?: string | null; height?: string | null; body?: Uint8Array; headers?: Record<string, string>;
} = {}) => {
  const headers: Record<string, string> = { ...auth, 'Content-Type': opts.type ?? 'image/jpeg', ...opts.headers };
  const width = opts.width === undefined ? '100' : opts.width;
  const height = opts.height === undefined ? '80' : opts.height;
  if (width !== null) headers['X-Photo-Width'] = width;
  if (height !== null) headers['X-Photo-Height'] = height;
  return app.request(`/api/admin/spots/${spotId}/photos`,
    { method: 'POST', headers, body: opts.body ?? bytes() }, env);
};
const listR2 = async () => (await env.PHOTOS.list()).objects.map((o) => o.key);

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM photos'),
    env.DB.prepare('DELETE FROM spot_tags'),
    env.DB.prepare('DELETE FROM spots'),
  ]);
  const keys = await listR2();
  if (keys.length) await env.PHOTOS.delete(keys);
});

test('upload to been spot stores in R2 and returns Photo with /api/photos/<id> url', async () => {
  const spotId = await createSpot(been);
  const r = await upload(spotId, { type: 'image/png', width: '640', height: '480' });
  expect(r.status).toBe(201);
  const photo = (await r.json()) as { id: string; url: string; width: number; height: number };
  expect(photo.url).toBe(`/api/photos/${photo.id}`);
  expect(photo.width).toBe(640);
  expect(photo.height).toBe(480);
  const keys = await listR2();
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatch(new RegExp(`^spots/${spotId}/.+\\.png$`));
});

test('upload to want spot -> 409', async () => {
  const spotId = await createSpot(want);
  const r = await upload(spotId);
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ error: 'want_spot' });
  expect(await listR2()).toHaveLength(0);
});

test('upload to missing spot -> 404', async () => {
  const r = await upload('nope');
  expect(r.status).toBe(404);
  expect(await r.json()).toEqual({ error: 'not_found' });
});

test('non-image content type -> 400', async () => {
  const spotId = await createSpot(been);
  const r = await upload(spotId, { type: 'text/plain' });
  expect(r.status).toBe(400);
  expect(((await r.json()) as { error: string }).error).toBe('invalid');
});

test('body over settings.photoMaxBytes -> 413', async () => {
  const spotId = await createSpot(been);
  const big = new Uint8Array(settings.photoMaxBytes + 1);
  const r = await upload(spotId, { body: big });
  expect(r.status).toBe(413);
  expect(await r.json()).toEqual({ error: 'too_large' });
  expect(await listR2()).toHaveLength(0);
});

test('lying Content-Length does not bypass the size limit', async () => {
  const spotId = await createSpot(been);
  const big = new Uint8Array(settings.photoMaxBytes + 1);
  const r = await upload(spotId, { body: big, headers: { 'Content-Length': '10' } });
  expect(r.status).toBe(413);
});

test('missing or non-numeric X-Photo-Width -> 400', async () => {
  const spotId = await createSpot(been);
  for (const width of [null, 'abc', '0', '-5', '1.5']) {
    const r = await upload(spotId, { width });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid');
  }
  expect((await upload(spotId, { height: 'x' })).status).toBe(400);
});

test('GET photo returns bytes, content type and immutable cache header', async () => {
  const spotId = await createSpot(been);
  const photo = (await (await upload(spotId, { type: 'image/webp', body: bytes(5) })).json()) as { id: string };
  const r = await app.request(`/api/photos/${photo.id}`, {}, env);
  expect(r.status).toBe(200);
  expect(r.headers.get('Content-Type')).toBe('image/webp');
  expect(r.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes(5));
  expect((await app.request('/api/photos/missing', {}, env)).status).toBe(404);
});

test('DELETE photo removes R2 object and row; spot photos list shrinks', async () => {
  const spotId = await createSpot(been);
  const p1 = (await (await upload(spotId)).json()) as { id: string };
  await upload(spotId);
  const del = await app.request(`/api/admin/photos/${p1.id}`, { method: 'DELETE', headers: auth }, env);
  expect(del.status).toBe(204);
  expect(await listR2()).toHaveLength(1);
  const spot = (await (await app.request(`/api/spots/${spotId}`, {}, env)).json()) as { photos: unknown[] };
  expect(spot.photos).toHaveLength(1);
  const again = await app.request(`/api/admin/photos/${p1.id}`, { method: 'DELETE', headers: auth }, env);
  expect(again.status).toBe(404);
});

test('upload without auth -> 401', async () => {
  const spotId = await createSpot(been);
  const r = await app.request(`/api/admin/spots/${spotId}/photos`, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'X-Photo-Width': '1', 'X-Photo-Height': '1' }, body: bytes(),
  }, env);
  expect(r.status).toBe(401);
});
