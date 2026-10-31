import { Hono } from 'hono';
import { requireEditor, verifyAccessJwtWithJose, type AccessVerifier } from './auth';
import type { Env } from './env';
import { spotInputSchema } from './validation';
import {
  createSpot, deleteSpot, getSpot, listSpots, listTags, updateSpot,
} from './db/spots';

export interface AppDeps {
  verifyAccessJwt?: AccessVerifier;
  fetch?: typeof fetch;
}

export function createApp(deps: AppDeps = {}) {
  const verify = deps.verifyAccessJwt ?? verifyAccessJwtWithJose;
  const app = new Hono<{ Bindings: Env; Variables: { editorEmail: string } }>().basePath('/api');

  app.use('/admin/*', requireEditor(verify));
  app.get('/admin/me', (c) => c.json({ email: c.get('editorEmail') }));

  const parseInput = async (req: Request) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
    return spotInputSchema.safeParse(body);
  };
  const invalid = (issues: unknown) => ({ error: 'invalid', issues });

  app.get('/spots', async (c) => {
    const status = c.req.query('status');
    if (status !== undefined && status !== 'been' && status !== 'want') {
      return c.json(invalid([{ path: ['status'], message: 'must be been or want' }]), 400);
    }
    return c.json(await listSpots(c.env.DB, { status, tag: c.req.query('tag') }));
  });

  app.get('/spots/:id', async (c) => {
    const spot = await getSpot(c.env.DB, c.req.param('id'));
    return spot ? c.json(spot) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/tags', async (c) => c.json(await listTags(c.env.DB)));

  app.post('/admin/spots', async (c) => {
    const parsed = await parseInput(c.req.raw);
    if (!parsed.success) return c.json(invalid(parsed.error.issues), 400);
    return c.json(await createSpot(c.env.DB, parsed.data), 201);
  });

  app.put('/admin/spots/:id', async (c) => {
    const parsed = await parseInput(c.req.raw);
    if (!parsed.success) return c.json(invalid(parsed.error.issues), 400);
    const id = c.req.param('id');
    const existing = await getSpot(c.env.DB, id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    if (parsed.data.status === 'want' && existing.photos.length > 0) {
      return c.json({ error: 'has_photos' }, 409);
    }
    return c.json(await updateSpot(c.env.DB, id, parsed.data));
  });

  app.delete('/admin/spots/:id', async (c) => {
    const keys = await deleteSpot(c.env.DB, c.req.param('id'));
    if (keys === null) return c.json({ error: 'not_found' }, 404);
    if (keys.length) await c.env.PHOTOS.delete(keys);
    return c.body(null, 204);
  });

  return app;
}
