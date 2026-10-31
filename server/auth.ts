import type { Context, MiddlewareHandler } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import { settings } from '../src/config/settings';
import type { Env } from './env';

const COOKIE = 'editor';

// The cookie is signed with a key derived from the password, so changing EDITOR_PASSWORD
// signs everyone out without a second secret to manage.
const signingKey = (password: string): string => `dumplings-session:${password}`;

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

/** Compares in constant time so response timing does not leak how much of a guess was right. */
export async function passwordMatches(guess: string, password: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(guess), sha256(password)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Sets the signed sign-in cookie. Its value is the expiry time, so an old cookie stops working. */
export async function startSession(c: Context<{ Bindings: Env }>, password: string): Promise<void> {
  const maxAge = settings.signInDays * 24 * 60 * 60;
  await setSignedCookie(c, COOKIE, String(Date.now() + maxAge * 1000), signingKey(password), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge,
  });
}

export const requireEditor: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (!c.env.EDITOR_PASSWORD) return c.json({ error: 'unauthorized' }, 401);
  const expires = await getSignedCookie(c, signingKey(c.env.EDITOR_PASSWORD), COOKIE);
  if (!expires || !(Number(expires) > Date.now())) return c.json({ error: 'unauthorized' }, 401);
  await next();
};
