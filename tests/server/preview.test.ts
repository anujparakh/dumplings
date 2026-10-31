import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';
import { onRequestGet } from '../../functions/spot/[id]';
import { createSpot } from '../../server/db/spots';
import { buildPreviewTags } from '../../server/preview';
import type { Spot } from '../../shared/types';

const o = 'https://dumplings.example.com';
const spot: Spot = {
  id: 's1', name: 'Golden Steamer', address: null, lat: 0, lng: 0, status: 'been', rating: 4,
  notes: 'Crispy bottoms', visitedOn: null, tags: [],
  photos: [{ id: 'p1', url: '/api/photos/p1', width: 1, height: 1 }],
  createdAt: '', updatedAt: '',
};

test('been spot: title, rating description, absolute og:image', () => {
  const html = buildPreviewTags(spot, o);
  expect(html).toContain('content="Golden Steamer · Ruchi&#39;s Dumpling Map"');
  expect(html).toContain('🥟🥟🥟🥟 4/5 Crispy bottoms');
  expect(html).toContain('content="https://dumplings.example.com/api/photos/p1"');
  expect(html).toContain('content="https://dumplings.example.com/spot/s1"');
  expect(html).toContain('twitter:card');
});

test('escapes quotes and tags in name and notes', () => {
  const html = buildPreviewTags({ ...spot, name: '"><script>x</script>' }, o);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&quot;&gt;&lt;script&gt;');
});

test('want spot uses wantToGo and no rating', () => {
  const html = buildPreviewTags({ ...spot, status: 'want', rating: null, photos: [] }, o);
  expect(html).toContain('On the list to try. Crispy bottoms');
  expect(html).not.toContain('/5');
  expect(html).not.toContain('og:image');
});

test('null spot uses defaults and no og:image', () => {
  const html = buildPreviewTags(null, o);
  expect(html).toContain('content="Ruchi&#39;s Dumpling Map"');
  expect(html).toContain("favorite dumpling spots".replace("'", '&#39;'));
  expect(html).not.toContain('og:image');
});

const page = '<html><head><title>x</title></head><body>app</body></html>';
const call = (id: string, status = 200) => onRequestGet({
  request: new Request(`${o}/spot/${id}`),
  env: { ...env, ASSETS: { fetch: async () => new Response(page, { status }) } },
  params: { id },
} as unknown as Parameters<typeof onRequestGet>[0]);

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM photos'),
    env.DB.prepare('DELETE FROM spot_tags'),
    env.DB.prepare('DELETE FROM spots'),
  ]);
});

test('function: unknown id still returns 200 HTML with default tags', async () => {
  const res = await call('nope');
  const body = await res.text();
  expect(res.status).toBe(200);
  expect(body).toContain('<body>app</body>');
  expect(body).toContain('og:title');
  expect(body).toContain('<title>Ruchi&#39;s Dumpling Map</title>');
});

test('function: known spot returns its tags', async () => {
  const created = await createSpot(env.DB, { name: 'Dumpling Lab', address: null, lat: 1, lng: 2,
    status: 'want', rating: null, notes: '', visitedOn: null, tags: [] });
  const body = await (await call(created.id)).text();
  expect(body).toContain('content="Dumpling Lab · Ruchi&#39;s Dumpling Map"');
  expect(body).toContain('<title>Dumpling Lab · Ruchi&#39;s Dumpling Map</title>');
});

test('function: non-200 asset returned unchanged', async () => {
  expect((await call('x', 404)).status).toBe(404);
});
