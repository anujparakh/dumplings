import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './env';

export type AccessVerifier = (token: string, env: Env) => Promise<{ email: string }>;

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksByDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksByDomain.set(teamDomain, jwks);
  }
  return jwks;
}

export const verifyAccessJwtWithJose: AccessVerifier = async (token, env) => {
  const { payload } = await jwtVerify(token, getJwks(env.ACCESS_TEAM_DOMAIN), {
    audience: env.ACCESS_AUD,
    issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
  });
  if (typeof payload.email !== 'string' || !payload.email) throw new Error('token has no email');
  return { email: payload.email };
};

export function isEditor(email: string, allowlist: string): boolean {
  const target = email.trim().toLowerCase();
  return allowlist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}

export const requireEditor =
  (verify: AccessVerifier): MiddlewareHandler<{ Bindings: Env; Variables: { editorEmail: string } }> =>
  async (c, next) => {
    let email: string;
    if (c.env.DEV_AUTH_EMAIL) {
      email = c.env.DEV_AUTH_EMAIL;
    } else {
      const token = c.req.header('Cf-Access-Jwt-Assertion');
      if (!token) return c.json({ error: 'unauthorized' }, 401);
      try {
        ({ email } = await verify(token, c.env));
      } catch {
        return c.json({ error: 'unauthorized' }, 401);
      }
    }
    if (!isEditor(email, c.env.EDITOR_EMAILS)) return c.json({ error: 'forbidden' }, 403);
    c.set('editorEmail', email);
    await next();
  };
