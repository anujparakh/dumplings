import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';
import {
  addPhoto,
  createSpot,
  deletePhoto,
  deleteSpot,
  getPhotoKey,
  countPhotos,
  getSpot,
  listSpots,
  listTags,
  updateSpot,
} from '../../server/db/spots';
import type { SpotInput } from '../../shared/types';

const been: SpotInput = { name: 'Golden Steamer', address: '123 Main St', lat: 29.76, lng: -95.37,
  status: 'been', rating: 4, notes: 'Crispy bottoms', visitedOn: '2026-10-12', tags: ['Dumplings', 'Fully veg menu'] };
const want: SpotInput = { ...been, name: 'Dumpling Lab', status: 'want', rating: null, visitedOn: null, tags: ['Dumplings'] };

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM photos'),
    env.DB.prepare('DELETE FROM spot_tags'),
    env.DB.prepare('DELETE FROM spots'),
  ]);
});

test('createSpot then getSpot round-trips all fields and tags', async () => {
  const s = await createSpot(env.DB, been);
  expect(await getSpot(env.DB, s.id)).toMatchObject({ ...been, photos: [] });
});

test('listSpots filters by status and tag, newest first', async () => {
  await createSpot(env.DB, { ...been, visitedOn: '2026-01-01', name: 'Old' });
  await createSpot(env.DB, been); await createSpot(env.DB, want);
  expect((await listSpots(env.DB, { status: 'want' })).map(s => s.name)).toEqual(['Dumpling Lab']);
  expect((await listSpots(env.DB, { tag: 'Fully veg menu' })).map(s => s.name)).toEqual(['Golden Steamer', 'Old']);
});

test('listSpots coverPhoto is the first photo by position', async () => {
  const s = await createSpot(env.DB, been);
  const first = await addPhoto(env.DB, s.id, { r2Key: 'a', width: 1, height: 2 });
  await addPhoto(env.DB, s.id, { r2Key: 'b', width: 3, height: 4 });
  const [listed] = await listSpots(env.DB, {});
  expect(listed.coverPhoto).toEqual({ id: first.id, url: `/api/photos/${first.id}`, width: 1, height: 2 });
  expect(await countPhotos(env.DB, s.id)).toBe(2);
});

test('listSpots coverPhoto is null without photos', async () => {
  await createSpot(env.DB, want);
  expect((await listSpots(env.DB, {}))[0].coverPhoto).toBeNull();
});

test('updateSpot replaces tags', async () => {
  const s = await createSpot(env.DB, been);
  const updated = await updateSpot(env.DB, s.id, { ...been, tags: ['Momos'] });
  expect(updated?.tags).toEqual(['Momos']);
  expect((await getSpot(env.DB, s.id))?.tags).toEqual(['Momos']);
  expect(await updateSpot(env.DB, 'missing', been)).toBeNull();
});

test('deleteSpot returns photo keys and removes rows', async () => {
  const s = await createSpot(env.DB, been);
  await addPhoto(env.DB, s.id, { r2Key: 'k1', width: 10, height: 10 });
  expect(await deleteSpot(env.DB, s.id)).toEqual(['k1']);
  expect(await getSpot(env.DB, s.id)).toBeNull();
  expect(await deleteSpot(env.DB, 'missing')).toBeNull();
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM photos').first<{ n: number }>();
  expect(left?.n).toBe(0);
});

test('photo key lookup and deletion', async () => {
  const s = await createSpot(env.DB, been);
  const p = await addPhoto(env.DB, s.id, { r2Key: 'k9', width: 5, height: 5 });
  expect(await getPhotoKey(env.DB, p.id)).toBe('k9');
  expect(await deletePhoto(env.DB, p.id)).toBe('k9');
  expect(await getPhotoKey(env.DB, p.id)).toBeNull();
  expect(await deletePhoto(env.DB, p.id)).toBeNull();
});

test('listTags is distinct and sorted', async () => {
  await createSpot(env.DB, been); await createSpot(env.DB, want);
  expect(await listTags(env.DB)).toEqual(['Dumplings', 'Fully veg menu']);
});

test('listSpots tag filter ignores case', async () => {
  await createSpot(env.DB, been);
  expect((await listSpots(env.DB, { tag: 'dumplings' })).map(s => s.name)).toEqual(['Golden Steamer']);
});
