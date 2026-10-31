import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useEditor } from '../../src/lib/useEditor';

afterEach(() => vi.unstubAllGlobals());

test('useEditor: me() 200 -> email', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ email: 'r@x.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useEditor());
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.email).toBe('r@x.com');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
});

test('useEditor: opaque redirect -> null', async () => {
  const opaque = { type: 'opaqueredirect', status: 0, ok: false } as unknown as Response;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(opaque));
  const { result } = renderHook(() => useEditor());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.email).toBeNull();
});
