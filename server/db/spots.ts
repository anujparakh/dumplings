import type { Photo, Spot, SpotFilter, SpotInput, SpotSummary } from '../../shared/types';

interface SpotRow {
  id: string; name: string; address: string | null; lat: number; lng: number;
  status: 'been' | 'want'; rating: number | null; notes: string;
  visited_on: string | null; created_at: string; updated_at: string;
}
interface PhotoRow { id: string; spot_id: string; width: number; height: number }

const photoUrl = (id: string) => `/api/photos/${id}`;
const toPhoto = (r: { id: string; width: number; height: number }): Photo =>
  ({ id: r.id, url: photoUrl(r.id), width: r.width, height: r.height });

function toSummary(r: SpotRow, tags: string[], coverPhoto: Photo | null): SpotSummary {
  return {
    id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng,
    status: r.status, rating: r.rating, notes: r.notes, visitedOn: r.visited_on,
    tags, coverPhoto, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function tagStatements(db: D1Database, id: string, tags: string[]) {
  return [...new Set(tags)].map((t) =>
    db.prepare('INSERT INTO spot_tags (spot_id, tag) VALUES (?, ?)').bind(id, t));
}

export async function listSpots(db: D1Database, filter: SpotFilter): Promise<SpotSummary[]> {
  const where: string[] = [];
  const args: string[] = [];
  if (filter.status) { where.push('status = ?'); args.push(filter.status); }
  if (filter.tag) { where.push('id IN (SELECT spot_id FROM spot_tags WHERE tag = ?)'); args.push(filter.tag); }
  const sql = `SELECT * FROM spots ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY COALESCE(visited_on, created_at) DESC, created_at DESC`;
  const [spots, tags, photos] = await db.batch([
    db.prepare(sql).bind(...args),
    db.prepare('SELECT spot_id, tag FROM spot_tags ORDER BY tag'),
    db.prepare('SELECT id, spot_id, width, height FROM photos ORDER BY position'),
  ]);
  const tagsBySpot = new Map<string, string[]>();
  for (const t of tags.results as { spot_id: string; tag: string }[]) {
    tagsBySpot.set(t.spot_id, [...(tagsBySpot.get(t.spot_id) ?? []), t.tag]);
  }
  const cover = new Map<string, Photo>();
  for (const p of photos.results as unknown as PhotoRow[]) {
    if (!cover.has(p.spot_id)) cover.set(p.spot_id, toPhoto(p));
  }
  return (spots.results as unknown as SpotRow[]).map((r) =>
    toSummary(r, tagsBySpot.get(r.id) ?? [], cover.get(r.id) ?? null));
}

export async function getSpot(db: D1Database, id: string): Promise<Spot | null> {
  const [spot, tags, photos] = await db.batch([
    db.prepare('SELECT * FROM spots WHERE id = ?').bind(id),
    db.prepare('SELECT tag FROM spot_tags WHERE spot_id = ? ORDER BY tag').bind(id),
    db.prepare('SELECT id, spot_id, width, height FROM photos WHERE spot_id = ? ORDER BY position').bind(id),
  ]);
  const row = (spot.results as unknown as SpotRow[])[0];
  if (!row) return null;
  const { coverPhoto: _cover, ...summary } = toSummary(
    row, (tags.results as { tag: string }[]).map((t) => t.tag), null);
  return { ...summary, photos: (photos.results as unknown as PhotoRow[]).map(toPhoto) };
}

export async function createSpot(db: D1Database, input: SpotInput): Promise<Spot> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO spots (id, name, address, lat, lng, status, rating, notes, visited_on, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, input.name, input.address, input.lat, input.lng, input.status, input.rating,
        input.notes, input.visitedOn, now, now),
    ...tagStatements(db, id, input.tags),
  ]);
  return (await getSpot(db, id))!;
}

export async function updateSpot(db: D1Database, id: string, input: SpotInput): Promise<Spot | null> {
  const exists = await db.prepare('SELECT 1 AS x FROM spots WHERE id = ?').bind(id).first();
  if (!exists) return null;
  await db.batch([
    db.prepare(`UPDATE spots SET name = ?, address = ?, lat = ?, lng = ?, status = ?, rating = ?,
      notes = ?, visited_on = ?, updated_at = ? WHERE id = ?`)
      .bind(input.name, input.address, input.lat, input.lng, input.status, input.rating,
        input.notes, input.visitedOn, new Date().toISOString(), id),
    db.prepare('DELETE FROM spot_tags WHERE spot_id = ?').bind(id),
    ...tagStatements(db, id, input.tags),
  ]);
  return getSpot(db, id);
}

export async function deleteSpot(db: D1Database, id: string): Promise<string[] | null> {
  const [spot, photos] = await db.batch([
    db.prepare('SELECT id FROM spots WHERE id = ?').bind(id),
    db.prepare('SELECT r2_key FROM photos WHERE spot_id = ? ORDER BY position').bind(id),
  ]);
  if (!spot.results.length) return null;
  await db.prepare('DELETE FROM spots WHERE id = ?').bind(id).run();
  return (photos.results as { r2_key: string }[]).map((p) => p.r2_key);
}

export async function listTags(db: D1Database): Promise<string[]> {
  const { results } = await db.prepare('SELECT DISTINCT tag FROM spot_tags ORDER BY tag').all<{ tag: string }>();
  return results.map((r) => r.tag);
}

export async function addPhoto(
  db: D1Database, spotId: string, p: { r2Key: string; width: number; height: number },
): Promise<Photo> {
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO photos (id, spot_id, r2_key, width, height, position, created_at)
    VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM photos WHERE spot_id = ?), ?)`)
    .bind(id, spotId, p.r2Key, p.width, p.height, spotId, new Date().toISOString()).run();
  return toPhoto({ id, width: p.width, height: p.height });
}

export async function deletePhoto(db: D1Database, photoId: string): Promise<string | null> {
  const row = await db.prepare('DELETE FROM photos WHERE id = ? RETURNING r2_key')
    .bind(photoId).first<{ r2_key: string }>();
  return row?.r2_key ?? null;
}

export async function getPhotoKey(db: D1Database, photoId: string): Promise<string | null> {
  const row = await db.prepare('SELECT r2_key FROM photos WHERE id = ?').bind(photoId).first<{ r2_key: string }>();
  return row?.r2_key ?? null;
}

export async function countPhotos(db: D1Database, spotId: string): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM photos WHERE spot_id = ?').bind(spotId).first<{ n: number }>();
  return row?.n ?? 0;
}
