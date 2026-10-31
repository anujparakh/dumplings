import { env } from 'cloudflare:workers';
import { createApp } from '../../server/app';

/** Signs in with the test password and returns a Cookie header value for editor requests. */
export async function editorCookie(): Promise<string> {
  const res = await createApp().request(
    '/api/login',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) },
    env,
  );
  if (res.status !== 204) throw new Error(`login failed: ${res.status}`);
  return res.headers.get('Set-Cookie')!.split(';')[0];
}
