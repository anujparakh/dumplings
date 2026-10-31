import { vi } from 'vitest';
import { api, ApiError } from '../../src/lib/api';

afterEach(() => vi.unstubAllGlobals());

const input = {
  name: 'Golden Steamer', address: null, lat: 29.76, lng: -95.37,
  status: 'want' as const, rating: null, visitedOn: null, notes: '', tags: [],
};

test('admin call redirected by an expired Access session -> ApiError(401, signed_out)', async () => {
  const opaque = { type: 'opaqueredirect', status: 0, ok: false } as unknown as Response;
  const fetchMock = vi.fn().mockResolvedValue(opaque);
  vi.stubGlobal('fetch', fetchMock);
  const err = await api.createSpot(input).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 401, code: 'signed_out' });
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual', method: 'POST' });
});

test('admin call network failure stays a TypeError', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(api.searchPlaces('golden', { lat: 1, lng: 2 })).rejects.toBeInstanceOf(TypeError);
});

test('public calls follow redirects normally', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  await api.listTags();
  expect(fetchMock.mock.calls[0][1]?.redirect).toBeUndefined();
});
