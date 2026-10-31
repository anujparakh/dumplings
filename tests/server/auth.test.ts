import { env } from 'cloudflare:workers';
import { expect, test, vi } from 'vitest';
import { createApp } from '../../server/app';
import { editorCookie } from './helpers';

const app = createApp();
const login = (body: unknown, e: object = env) =>
  app.request(
    '/api/login',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    e,
  );
const me = (cookie?: string, e: object = env) =>
  app.request('/api/admin/me', cookie ? { headers: { Cookie: cookie } } : {}, e);

test('no cookie -> 401', async () => {
  expect((await me()).status).toBe(401);
});

test('wrong or missing password -> 401 and no cookie', async () => {
  for (const body of [{ password: 'nope' }, { password: '' }, {}, { password: 42 }]) {
    const res = await login(body);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'wrong_password' });
    expect(res.headers.get('Set-Cookie')).toBeNull();
  }
});

test('right password -> locked-down cookie that unlocks admin routes', async () => {
  const res = await login({ password: 'test-password' });
  expect(res.status).toBe(204);
  const setCookie = res.headers.get('Set-Cookie')!;
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).toMatch(/Secure/i);
  expect(setCookie).toMatch(/SameSite=Strict/i);
  const ok = await me(setCookie.split(';')[0]);
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ signedIn: true });
});

test('forged or tampered cookie -> 401', async () => {
  const real = await editorCookie();
  const [name, value] = real.split('=');
  const [, signature] = decodeURIComponent(value).split('.');
  const later = String(Date.now() + 10 ** 12);
  expect((await me(`${name}=${encodeURIComponent(`${later}.${signature}`)}`)).status).toBe(401);
  expect((await me(`${name}=${later}`)).status).toBe(401);
});

test('changing the password signs everyone out', async () => {
  const cookie = await editorCookie();
  expect((await me(cookie, { ...env, EDITOR_PASSWORD: 'new-password' })).status).toBe(401);
});

test('expired session -> 401', async () => {
  const cookie = await editorCookie();
  vi.useFakeTimers({ now: Date.now() + 91 * 24 * 60 * 60 * 1000 });
  try {
    expect((await me(cookie)).status).toBe(401);
  } finally {
    vi.useRealTimers();
  }
});

test('no password configured -> login 503 and admin routes stay locked', async () => {
  const cookie = await editorCookie();
  const noPassword = { ...env, EDITOR_PASSWORD: '' };
  expect((await login({ password: '' }, noPassword)).status).toBe(503);
  expect((await me(cookie, noPassword)).status).toBe(401);
});
