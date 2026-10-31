import { Hono } from 'hono';
import { requireEditor, verifyAccessJwtWithJose, type AccessVerifier } from './auth';
import type { Env } from './env';

export interface AppDeps {
  verifyAccessJwt?: AccessVerifier;
  fetch?: typeof fetch;
}

export function createApp(deps: AppDeps = {}) {
  const verify = deps.verifyAccessJwt ?? verifyAccessJwtWithJose;
  const app = new Hono<{ Bindings: Env; Variables: { editorEmail: string } }>().basePath('/api');

  app.use('/admin/*', requireEditor(verify));
  app.get('/admin/me', (c) => c.json({ email: c.get('editorEmail') }));

  return app;
}
