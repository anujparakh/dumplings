import { vi } from 'vitest';
import { api, ApiError, isSignedOut } from '../../src/lib/api';

afterEach(() => vi.unstubAllGlobals());

const input = {
  name: 'Golden Steamer', address: null, lat: 29.76, lng: -95.37,
  status: 'want' as const, rating: null, visitedOn: null, notes: '', tags: [],
};

test('admin call with an expired sign-in -> ApiError(401) that reads as signed out', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401 })));
  const err = await api.createSpot(input).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 401, code: 'unauthorized' });
  expect(isSignedOut(err)).toBe(true);
});

test('admin call network failure stays a TypeError', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(api.searchPlaces('golden', { lat: 1, lng: 2 })).rejects.toBeInstanceOf(TypeError);
});

test('login posts the password and reports a wrong one', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":"wrong_password"}', { status: 401 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(api.login('nope')).rejects.toMatchObject({ status: 401, code: 'wrong_password' });
  expect(fetchMock.mock.calls[0][0]).toBe('/api/login');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ password: 'nope' });
});
