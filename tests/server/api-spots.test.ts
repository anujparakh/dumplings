import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';
import { createApp } from '../../server/app';
import { addPhoto } from '../../server/db/spots';
import { fakeVerifier } from './helpers';

const app = createApp({ verifyAccessJwt: fakeVerifier('ruchi@example.com') });
const authHeaders = { 'Cf-Access-Jwt-Assertion': 'test', 'Content-Type': 'application/json' };

const been = { name: 'Golden Steamer', address: '123 Main St', lat: 29.76, lng: -95.37,
  status: 'been', rating: 4, notes: 'Crispy', visitedOn: '2026-10-12', tags: ['Dumplings'] };
const want = { ...been, name: 'Dumpling Lab', status: 'want', rating: null, visitedOn: null };

const send = (method: string, path: string, body?: unknown) =>
  app.request(path, { method, headers: authHeaders, body: body === undefined ? undefined : JSON.stringify(body) }, env);
const post = (path: string, body: unknown) => send('POST', path, body);
const put = (path: string, body: unknown) => send('PUT', path, body);

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM photos'),
    env.DB.prepare('DELETE FROM spot_tags'),
    env.DB.prepare('DELETE FROM spots'),
  ]);
});

test('POST want with a rating is rejected', async () => {
  const r = await post('/api/admin/spots', { ...want, rating: 3 });
  expect(r.status).toBe(400);
  const body = (await r.json()) as { error: string; issues: unknown };
  expect(body.error).toBe('invalid');
  expect(body.issues).toBeDefined();
});

test('POST been with rating 6 or 0 is rejected; rating null is allowed', async () => {
  expect((await post('/api/admin/spots', { ...been, rating: 6 })).status).toBe(400);
  expect((await post('/api/admin/spots', { ...been, rating: 0 })).status).toBe(400);
  expect((await post('/api/admin/spots', { ...been, rating: null })).status).toBe(201);
});

test('POST normalizes tags', async () => {
  const r = await post('/api/admin/spots', { ...been, tags: [' dumplings ', 'Dumplings', 'Fully  veg menu', ''] });
  expect(r.status).toBe(201);
  const s = (await r.json()) as { tags: string[] };
  expect(s.tags).toEqual(['dumplings', 'Fully veg menu']);
});

test('tags longer than 30 chars are rejected', async () => {
  expect((await post('/api/admin/spots', { ...been, tags: ['x'.repeat(31)] })).status).toBe(400);
});

test('want spot: visitedOn must be null', async () => {
  expect((await post('/api/admin/spots', { ...want, visitedOn: '2026-10-12' })).status).toBe(400);
  expect((await post('/api/admin/spots', want)).status).toBe(201);
});

test('lat/lng out of range or name empty -> 400', async () => {
  expect((await post('/api/admin/spots', { ...been, lat: 91 })).status).toBe(400);
  expect((await post('/api/admin/spots', { ...been, lng: -181 })).status).toBe(400);
  expect((await post('/api/admin/spots', { ...been, name: '   ' })).status).toBe(400);
});

test('malformed JSON body -> 400', async () => {
  const r = await app.request('/api/admin/spots', { method: 'POST', headers: authHeaders, body: '{nope' }, env);
  expect(r.status).toBe(400);
});

test('admin routes require auth', async () => {
  const r = await app.request('/api/admin/spots', { method: 'POST', body: JSON.stringify(been) }, env);
  expect(r.status).toBe(401);
});

test('PUT switching been->want while still sending a rating -> 400', async () => {
  const created = (await (await post('/api/admin/spots', been)).json()) as { id: string };
  const r = await put(`/api/admin/spots/${created.id}`, { ...been, status: 'want' });
  expect(r.status).toBe(400);
});

test('PUT switching been->want when the spot has photos returns 409', async () => {
  const created = (await (await post('/api/admin/spots', been)).json()) as { id: string };
  await addPhoto(env.DB, created.id, { r2Key: `spots/${created.id}/p1.jpg`, width: 10, height: 10 });
  const r = await put(`/api/admin/spots/${created.id}`, want);
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual({ error: 'has_photos' });
});

test('PUT been->want without photos succeeds', async () => {
  const created = (await (await post('/api/admin/spots', been)).json()) as { id: string };
  const r = await put(`/api/admin/spots/${created.id}`, want);
  expect(r.status).toBe(200);
});

test('PUT want->been with rating 5 succeeds', async () => {
  const created = (await (await post('/api/admin/spots', want)).json()) as { id: string };
  const r = await put(`/api/admin/spots/${created.id}`, { ...been, rating: 5 });
  expect(r.status).toBe(200);
  const s = (await r.json()) as { status: string; rating: number };
  expect(s.status).toBe('been');
  expect(s.rating).toBe(5);
});

test('PUT unknown id -> 404', async () => {
  expect((await put('/api/admin/spots/nope', been)).status).toBe(404);
});

test('GET /api/spots/:id unknown -> 404', async () => {
  const r = await app.request('/api/spots/nope', {}, env);
  expect(r.status).toBe(404);
  expect(await r.json()).toEqual({ error: 'not_found' });
});

test('GET /api/spots/:id returns the spot', async () => {
  const created = (await (await post('/api/admin/spots', been)).json()) as { id: string };
  const r = await app.request(`/api/spots/${created.id}`, {}, env);
  expect(r.status).toBe(200);
  expect(((await r.json()) as { name: string }).name).toBe('Golden Steamer');
});

test('DELETE removes spot and its R2 objects', async () => {
  const created = (await (await post('/api/admin/spots', been)).json()) as { id: string };
  const key = `spots/${created.id}/p1.jpg`;
  await env.PHOTOS.put(key, 'x');
  await addPhoto(env.DB, created.id, { r2Key: key, width: 1, height: 1 });
  const r = await send('DELETE', `/api/admin/spots/${created.id}`);
  expect(r.status).toBe(204);
  expect(await env.PHOTOS.get(key)).toBeNull();
  expect((await app.request(`/api/spots/${created.id}`, {}, env)).status).toBe(404);
});

test('DELETE unknown id -> 404', async () => {
  expect((await send('DELETE', '/api/admin/spots/nope')).status).toBe(404);
});

test('notes containing <script> round-trip unchanged as data', async () => {
  const notes = '<script>alert(1)</script>';
  const created = (await (await post('/api/admin/spots', { ...been, notes })).json()) as { id: string };
  const s = (await (await app.request(`/api/spots/${created.id}`, {}, env)).json()) as { notes: string };
  expect(s.notes).toBe(notes);
});

test('public GET /api/spots needs no auth header, filters by status and tag', async () => {
  await post('/api/admin/spots', been);
  await post('/api/admin/spots', { ...want, tags: ['Other'] });
  const all = (await (await app.request('/api/spots', {}, env)).json()) as unknown[];
  expect(all).toHaveLength(2);
  const wants = (await (await app.request('/api/spots?status=want', {}, env)).json()) as { name: string }[];
  expect(wants.map((s) => s.name)).toEqual(['Dumpling Lab']);
  const tagged = (await (await app.request('/api/spots?tag=Dumplings', {}, env)).json()) as unknown[];
  expect(tagged).toHaveLength(1);
});

test('GET /api/spots with invalid status -> 400', async () => {
  expect((await app.request('/api/spots?status=maybe', {}, env)).status).toBe(400);
});

test('GET /api/tags lists distinct tags', async () => {
  await post('/api/admin/spots', been);
  await post('/api/admin/spots', { ...want, tags: ['Dumplings', 'Zed'] });
  expect(await (await app.request('/api/tags', {}, env)).json()).toEqual(['Dumplings', 'Zed']);
});
