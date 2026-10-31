import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useEditor } from '../../src/lib/useEditor';

afterEach(() => vi.unstubAllGlobals());

test('useEditor: /api/admin/me 200 -> signed in', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"signedIn":true}', { status: 200 })));
  const { result } = renderHook(() => useEditor());
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.signedIn).toBe(true);
});

test('useEditor: 401 or network error -> signed out', async () => {
  for (const fetchMock of [
    vi.fn().mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401 })),
    vi.fn().mockRejectedValue(new TypeError('offline')),
  ]) {
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useEditor());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.signedIn).toBe(false);
  }
});
