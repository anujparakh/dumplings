import { Hono } from 'hono';
import { requireEditor, verifyAccessJwtWithJose, type AccessVerifier } from './auth';
import type { Env } from './env';
import { spotInputSchema } from './validation';
import { settings } from '../src/config/settings';
import {
  addPhoto, createSpot, deletePhoto, deleteSpot, getPhotoKey, getSpot, listSpots, listTags, updateSpot,
} from './db/spots';

const PHOTO_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const positiveInt = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null);

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

  app.post('/admin/spots/:id/photos', async (c) => {
    const spotId = c.req.param('id');
    const spot = await getSpot(c.env.DB, spotId);
    if (!spot) return c.json({ error: 'not_found' }, 404);
    if (spot.status === 'want') return c.json({ error: 'want_spot' }, 409);

    const type = (c.req.header('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = PHOTO_EXT[type];
    const width = positiveInt(c.req.header('X-Photo-Width'));
    const height = positiveInt(c.req.header('X-Photo-Height'));
    const issues = [
      ...(ext ? [] : [{ path: ['Content-Type'], message: 'must be image/jpeg, image/png or image/webp' }]),
      ...(width ? [] : [{ path: ['X-Photo-Width'], message: 'must be a positive integer' }]),
      ...(height ? [] : [{ path: ['X-Photo-Height'], message: 'must be a positive integer' }]),
    ];
    if (issues.length || !ext || !width || !height) return c.json(invalid(issues), 400);

    const declared = Number(c.req.header('Content-Length'));
    if (declared > settings.photoMaxBytes) return c.json({ error: 'too_large' }, 413);
    const data = await c.req.arrayBuffer();
    if (data.byteLength > settings.photoMaxBytes) return c.json({ error: 'too_large' }, 413);

    const r2Key = `spots/${spotId}/${crypto.randomUUID()}.${ext}`;
    await c.env.PHOTOS.put(r2Key, data, { httpMetadata: { contentType: type } });
    try {
      return c.json(await addPhoto(c.env.DB, spotId, { r2Key, width, height }), 201);
    } catch (e) {
      await c.env.PHOTOS.delete(r2Key);
      throw e;
    }
  });

  app.get('/photos/:photoId', async (c) => {
    const key = await getPhotoKey(c.env.DB, c.req.param('photoId'));
    const object = key ? await c.env.PHOTOS.get(key) : null;
    if (!object) return c.json({ error: 'not_found' }, 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  });

  app.delete('/admin/photos/:photoId', async (c) => {
    const key = await deletePhoto(c.env.DB, c.req.param('photoId'));
    if (key === null) return c.json({ error: 'not_found' }, 404);
    await c.env.PHOTOS.delete(key);
    return c.body(null, 204);
  });

  return app;
}
