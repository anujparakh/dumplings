import { env } from 'cloudflare:workers';
import { expect, test } from 'vitest';
import { createApp } from '../../server/app';
import { fakeVerifier } from './helpers';

const withJwt = { headers: { 'Cf-Access-Jwt-Assertion': 'token' } };

test('no Cf-Access-Jwt-Assertion header -> 401', async () => {
  const app = createApp({ verifyAccessJwt: fakeVerifier('ruchi@example.com') });
  const res = await app.request('/api/admin/me', {}, env);
  expect(res.status).toBe(401);
});

test('verifier throws -> 401', async () => {
  const app = createApp({
    verifyAccessJwt: async () => {
      throw new Error('bad token');
    },
  });
  const res = await app.request('/api/admin/me', withJwt, env);
  expect(res.status).toBe(401);
});

test('valid token, email not in EDITOR_EMAILS -> 403', async () => {
  const app = createApp({ verifyAccessJwt: fakeVerifier('stranger@example.com') });
  const res = await app.request('/api/admin/me', withJwt, env);
  expect(res.status).toBe(403);
});

test('email match is case-insensitive', async () => {
  const app = createApp({ verifyAccessJwt: fakeVerifier('Ruchi@Example.com') });
  const res = await app.request('/api/admin/me', withJwt, env);
  expect(res.status).toBe(200);
});

test('/api/admin/me returns the email', async () => {
  const app = createApp({ verifyAccessJwt: fakeVerifier('owner@example.com') });
  const res = await app.request('/api/admin/me', withJwt, env);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ email: 'owner@example.com' });
});

test('DEV_AUTH_EMAIL bypasses JWT but still enforces allowlist', async () => {
  const app = createApp({
    verifyAccessJwt: async () => {
      throw new Error('should not be called');
    },
  });
  const ok = await app.request('/api/admin/me', {}, { ...env, DEV_AUTH_EMAIL: 'ruchi@example.com' });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ email: 'ruchi@example.com' });
  const denied = await app.request('/api/admin/me', {}, { ...env, DEV_AUTH_EMAIL: 'nope@example.com' });
  expect(denied.status).toBe(403);
});

test('DEV_AUTH_EMAIL is ignored when ACCESS_TEAM_DOMAIN is set', async () => {
  const app = createApp({ verifyAccessJwt: fakeVerifier('ruchi@example.com') });
  const res = await app.request(
    '/api/admin/me',
    {},
    { ...env, DEV_AUTH_EMAIL: 'ruchi@example.com', ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com' },
  );
  expect(res.status).toBe(401);
});
