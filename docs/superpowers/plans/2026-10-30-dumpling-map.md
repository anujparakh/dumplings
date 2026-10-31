# Ruchi's Dumpling Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free, mobile-first public map where Ruchi (and the owner) pin, rate, review, and photograph vegetarian dumpling spots and "want to go" spots, extensible to other foods via tags.

**Architecture:** One Cloudflare Pages project. A React + Vite single-page app is the static site; Pages Functions (Hono) under `/api/*` provide the JSON API backed by D1 (spots, tags, photo rows) and R2 (photo files). A separate Pages Function on `/spot/:id` injects per-spot Open Graph tags into `index.html` for rich link previews. Cloudflare Access guards `/admin*` and `/api/admin/*`; the API also verifies the Access JWT and an email allowlist.

**Tech Stack:** TypeScript, React 18, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), React Router, MapLibre GL JS + OpenFreeMap tiles, Photon search (swappable to Google Places), Hono, zod, jose, Cloudflare Pages Functions, D1, R2, Vitest (`@cloudflare/vitest-pool-workers` for server, jsdom + Testing Library for web).

**Spec:** `docs/superpowers/specs/2026-10-30-dumpling-map-design.md`

## Global Constraints

- App title: `Ruchi's Dumpling Map`.
- Mobile first: every screen is designed at ~375px width first; desktop is a widened version of the same layout.
- Free to host: Cloudflare free tier only. No paid APIs; Google Places only if `SEARCH_PROVIDER=google` is set later.
- Only emails in `EDITOR_EMAILS` can write. Everyone can read, no account.
- **Easy to change:** components contain no user-facing string literals, no raw colors, no icon paths, no magic settings. They import from:
  - `src/config/text.ts` (all copy)
  - `src/theme/theme.css` (Tailwind `@theme` tokens: colors, fonts, radii)
  - `src/config/icons.ts` (names to files in `public/icons/`)
  - `src/config/settings.ts` (rating scale, map defaults, tags, limits)
- Rating: integer 1 to 5 (`settings.ratingMax = 5`), shown as dumpling icons, only for `been` spots.
- `want` spots never have a rating or photos.
- One review per spot (editing replaces it). Do not design anything that blocks adding a `visits` table later.
- Default map center Houston `{ lat: 29.7604, lng: -95.3698 }`, zoom `11`; distances in miles.
- Hidden from search engines: `noindex` via meta tag, `X-Robots-Tag` header, and `robots.txt`, controlled by `settings.allowIndexing = false`.
- Writes require a working connection. No offline drafts or service worker.
- Commit each task on `main` with a conventional message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not create branches or worktrees. Never use em-dash or other Unicode dashes in code, comments, or docs.

## Review Focus

1. **Big phone photos (12 MP, HEIC from iPhone):** the client resizes to max edge 1600px JPEG before upload; the server rejects non-image types and bodies over 5 MB with 400/413 instead of storing them. Tests in Task 5 and Task 10.
2. **Status consistency:** a `want` spot sent with a rating, a photo upload to a `want` spot, or switching a `been` spot with photos back to `want` must be rejected (400/409), not silently saved. Tests in Task 4 and Task 5.
3. **Anyone hitting the write API directly:** `/api/admin/*` without a valid Access JWT returns 401; a valid JWT whose email is not in `EDITOR_EMAILS` (case-insensitive) returns 403. Tests in Task 3.
4. **Shared link to a deleted or bogus spot:** `/spot/nope` still returns the app with default preview tags (200, no crash) and the page shows the not-found text. Tests in Task 7 and Task 11.
5. **Quotes, `<script>`, and emoji in spot names/notes:** preview meta tags are HTML-escaped and React renders text safely. Test in Task 7.

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, wrangler.toml, .dev.vars.example
vitest.web.config.ts          # jsdom tests for src/
vitest.server.config.ts       # workers-pool tests for server/ and functions/
index.html                    # noindex meta, root div
public/robots.txt, public/_headers, public/icons/*.svg
migrations/0001_init.sql
shared/types.ts               # types used by both server and web
src/config/text.ts, settings.ts, icons.ts
src/theme/theme.css           # Tailwind import + @theme tokens
src/main.tsx, src/App.tsx     # router
src/lib/api.ts                # typed fetch client
src/lib/useEditor.ts          # signed-in check
src/lib/geo.ts                # distance + formatting
src/lib/image.ts              # client-side resize
src/components/DumplingRating.tsx, SpotCard.tsx, FilterBar.tsx, MapView.tsx,
               SpotDrawer.tsx, PhotoCarousel.tsx, PlaceSearch.tsx,
               PhotoPicker.tsx, TagEditor.tsx, Header.tsx
src/pages/HomePage.tsx, SpotPage.tsx, SpotFormPage.tsx
server/env.ts                 # Env bindings type
server/app.ts                 # createApp(): Hono app, all /api routes
server/auth.ts                # requireEditor middleware
server/validation.ts          # zod schemas, normalizeTags
server/db/spots.ts            # D1 repository
server/search.ts              # Photon + Google providers
server/preview.ts             # buildPreviewTags
functions/api/[[route]].ts    # mounts createApp()
functions/spot/[id].ts        # injects preview tags
tests/server/*.test.ts, tests/web/*.test.tsx
README.md                     # setup + deploy + Access setup
```

## Shared types (`shared/types.ts`, created in Task 2)

```ts
export type SpotStatus = 'been' | 'want';
export interface Photo { id: string; url: string; width: number; height: number }
export interface Spot {
  id: string; name: string; address: string | null; lat: number; lng: number;
  status: SpotStatus; rating: number | null; notes: string;
  visitedOn: string | null;          // YYYY-MM-DD
  tags: string[]; photos: Photo[]; createdAt: string; updatedAt: string;
}
export type SpotSummary = Omit<Spot, 'photos'> & { coverPhoto: Photo | null };
export type SpotInput = Omit<Spot, 'id' | 'photos' | 'createdAt' | 'updatedAt'>;
export interface PlaceResult { name: string; address: string | null; lat: number; lng: number }
export interface SpotFilter { status?: SpotStatus; tag?: string }
```

Photo `url` is always `/api/photos/<photoId>`.

---

### Task 1: Scaffold, config files, theme, noindex

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `wrangler.toml`, `.dev.vars.example`, `.gitignore` (include `node_modules`, `dist`, `.wrangler`, `.dev.vars`, `.superpowers/`), `index.html`, `public/robots.txt`, `public/_headers`, `public/icons/dumpling.svg`, `public/icons/pin-been.svg`, `public/icons/pin-want.svg`, `src/config/text.ts`, `src/config/settings.ts`, `src/config/icons.ts`, `src/theme/theme.css`, `src/main.tsx`, `src/App.tsx`, `src/components/Header.tsx`, `vitest.web.config.ts`
- Modify: `CLAUDE.md` (fill in the Commands section)
- Test: `tests/web/header.test.tsx`

**Interfaces:**
- Produces:
  - `text` (`as const` object; start with `appTitle`, `menu`, `signIn`, `filters.been`, `filters.want`, `filters.allFoods`, `views.map`, `views.feed`, `notFound`; later tasks add keys here).
  - `settings`: `ratingMax: 5`, `defaultCenter`, `defaultZoom: 11`, `distanceUnit: 'mi'`, `defaultTags: ['Dumplings', 'Fully veg menu']`, `newSpotTags: ['Dumplings']`, `mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty'`, `photoMaxEdge: 1600`, `photoQuality: 0.82`, `photoMaxBytes: 5_000_000`, `searchMinChars: 3`, `allowIndexing: false`.
  - `icons`: `{ rating, ratingEmpty?, pinBeen, pinWant, logo, tags: Record<string, string> }`, all paths under `/icons/`.
  - Tailwind tokens in `theme.css` under `@theme`: `--color-primary` (#d9534f), `--color-primary-contrast`, `--color-surface`, `--color-surface-muted`, `--color-ink`, `--color-ink-muted`, `--color-tag`, `--font-sans`, `--radius-card`. Components use classes like `bg-primary`, `text-ink-muted`, `rounded-card`.

- [ ] **Step 1: Scaffold** a Vite React TS app in the repo root, add Tailwind v4 via `@tailwindcss/vite`, React Router, Vitest + jsdom + Testing Library. Scripts: `dev` (vite, proxies `/api` and `/spot` to `http://localhost:8788`), `dev:api` (`wrangler pages dev dist --port 8788`), `build`, `test:web`, `test:server`, `test` (both), `db:migrate:local` (`wrangler d1 migrations apply dumplings --local`).
- [ ] **Step 2: `wrangler.toml`**: `name = "dumplings"`, `pages_build_output_dir = "dist"`, `compatibility_flags = ["nodejs_compat"]`, D1 binding `DB` (database `dumplings`), R2 binding `PHOTOS` (bucket `dumplings-photos`), `[vars]` `SEARCH_PROVIDER = "photon"`, `EDITOR_EMAILS = ""`, `ACCESS_TEAM_DOMAIN = ""`, `ACCESS_AUD = ""`. `.dev.vars.example` holds `DEV_AUTH_EMAIL=you@example.com` and `EDITOR_EMAILS=you@example.com`.
- [ ] **Step 3: noindex**: `index.html` gets `<meta name="robots" content="noindex, nofollow">`; `public/_headers` sets `X-Robots-Tag: noindex` on `/*`; `robots.txt` disallows `/`. Add a comment in `settings.ts` next to `allowIndexing` listing these three places.
- [ ] **Step 4: Write the failing test** `tests/web/header.test.tsx`:

```tsx
import { text } from '../../src/config/text';
test('header shows the app title from text config', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: text.appTitle })).toBeInTheDocument();
});
test('app title is Ruchi\'s Dumpling Map', () => {
  expect(text.appTitle).toBe("Ruchi's Dumpling Map");
});
```

- [ ] **Step 5: Run** `npm run test:web`. Expected: FAIL (Header missing).
- [ ] **Step 6: Implement `Header(): JSX.Element`** (logo from `icons.logo`, `<h1>` with `text.appTitle`, menu button). `App.tsx` routes: `/` HomePage, `/spot/:id` SpotPage, `/admin` (Navigate to `/`), `/admin/new` and `/admin/spot/:id/edit` SpotFormPage. Stub pages render the Header only.
- [ ] **Step 7: Run** `npm run test:web` (PASS) and `npm run build` (succeeds). `npm run dev` shows the title in a phone-width browser.
- [ ] **Step 8: Update `CLAUDE.md`** Commands section with the scripts above.

---

### Task 2: Database schema and spot repository

**Files:**
- Create: `migrations/0001_init.sql`, `shared/types.ts`, `server/env.ts`, `server/db/spots.ts`, `vitest.server.config.ts`, `tests/server/setup.ts`
- Test: `tests/server/spots-repo.test.ts`

**Interfaces:**
- Produces:
  - `Env` in `server/env.ts`: `{ DB: D1Database; PHOTOS: R2Bucket; ASSETS: Fetcher; EDITOR_EMAILS: string; ACCESS_TEAM_DOMAIN: string; ACCESS_AUD: string; DEV_AUTH_EMAIL?: string; SEARCH_PROVIDER: 'photon' | 'google'; GOOGLE_PLACES_KEY?: string }`
  - `listSpots(db: D1Database, filter: SpotFilter): Promise<SpotSummary[]>`, ordered by `COALESCE(visited_on, created_at)` descending.
  - `getSpot(db, id: string): Promise<Spot | null>`
  - `createSpot(db, input: SpotInput): Promise<Spot>` (id from `crypto.randomUUID()`)
  - `updateSpot(db, id, input: SpotInput): Promise<Spot | null>`
  - `deleteSpot(db, id): Promise<string[] | null>`: returns the deleted photos' R2 keys, or null if the spot doesn't exist.
  - `listTags(db): Promise<string[]>`: distinct, sorted.
  - `addPhoto(db, spotId, p: { r2Key: string; width: number; height: number }): Promise<Photo>`
  - `deletePhoto(db, photoId): Promise<string | null>`: returns the R2 key.
  - `getPhotoKey(db, photoId): Promise<string | null>`
  - `countPhotos(db, spotId): Promise<number>`

- [ ] **Step 1: Write the migration.** Tables:
  - `spots(id TEXT PK, name TEXT NOT NULL, address TEXT, lat REAL NOT NULL, lng REAL NOT NULL, status TEXT NOT NULL CHECK(status IN ('been','want')), rating INTEGER CHECK(rating BETWEEN 1 AND 5), notes TEXT NOT NULL DEFAULT '', visited_on TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
  - `spot_tags(spot_id TEXT REFERENCES spots(id) ON DELETE CASCADE, tag TEXT NOT NULL, PRIMARY KEY(spot_id, tag))`
  - `photos(id TEXT PK, spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE, r2_key TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, position INTEGER NOT NULL, created_at TEXT NOT NULL)`
  - Indexes on `spot_tags(tag)` and `photos(spot_id)`.
- [ ] **Step 2: Configure `vitest.server.config.ts`** with `@cloudflare/vitest-pool-workers` (`defineWorkersConfig`). Use `readD1Migrations('migrations')` exposed as `TEST_MIGRATIONS`, miniflare `d1Databases: ['DB']` and `r2Buckets: ['PHOTOS']`, and test vars `EDITOR_EMAILS: 'ruchi@example.com,owner@example.com'`. `tests/server/setup.ts` calls `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`. Pin versions that the pool's docs list as compatible.
- [ ] **Step 3: Write the failing tests** in `tests/server/spots-repo.test.ts`:

```ts
const been: SpotInput = { name: 'Golden Steamer', address: '123 Main St', lat: 29.76, lng: -95.37,
  status: 'been', rating: 4, notes: 'Crispy bottoms', visitedOn: '2026-10-12', tags: ['Dumplings', 'Fully veg menu'] };
const want: SpotInput = { ...been, name: 'Dumpling Lab', status: 'want', rating: null, visitedOn: null, tags: ['Dumplings'] };

test('createSpot then getSpot round-trips all fields and tags', async () => {
  const s = await createSpot(env.DB, been);
  expect(await getSpot(env.DB, s.id)).toMatchObject({ ...been, photos: [] });
});
test('listSpots filters by status and tag, newest first', async () => {
  await createSpot(env.DB, { ...been, visitedOn: '2026-01-01', name: 'Old' });
  await createSpot(env.DB, been); await createSpot(env.DB, want);
  expect((await listSpots(env.DB, { status: 'want' })).map(s => s.name)).toEqual(['Dumpling Lab']);
  expect((await listSpots(env.DB, { tag: 'Fully veg menu' })).map(s => s.name)).toEqual(['Golden Steamer', 'Old']);
});
test('listSpots coverPhoto is the first photo by position', async () => { /* add 2 photos, expect coverPhoto.id === first */ });
test('updateSpot replaces tags', async () => { /* tags ['Momos'] -> getSpot tags ['Momos'] */ });
test('deleteSpot returns photo keys and removes rows', async () => {
  const s = await createSpot(env.DB, been);
  await addPhoto(env.DB, s.id, { r2Key: 'k1', width: 10, height: 10 });
  expect(await deleteSpot(env.DB, s.id)).toEqual(['k1']);
  expect(await getSpot(env.DB, s.id)).toBeNull();
  expect(await deleteSpot(env.DB, 'missing')).toBeNull();
});
test('listTags is distinct and sorted', async () => { /* expect ['Dumplings','Fully veg menu'] */ });
```

- [ ] **Step 4: Run** `npm run test:server`. Expected: FAIL (module not found).
- [ ] **Step 5: Implement `server/db/spots.ts`** with the signatures above. Use `db.batch` for spot + tags writes (D1 enforces foreign keys by default, so cascades work). Map snake_case rows to the camelCase types.
- [ ] **Step 6: Run** `npm run test:server`. Expected: PASS.

---

### Task 3: Editor auth (Cloudflare Access JWT + allowlist)

**Files:**
- Create: `server/auth.ts`, `server/app.ts`, `functions/api/[[route]].ts`, `tests/server/helpers.ts`
- Test: `tests/server/auth.test.ts`

**Interfaces:**
- Produces:
  - `createApp(deps?: { verifyAccessJwt?: AccessVerifier; fetch?: typeof fetch }): Hono<{ Bindings: Env }>` with `basePath('/api')`; `requireEditor` mounted on `/api/admin/*`. `deps.verifyAccessJwt` defaults to `verifyAccessJwtWithJose`.
  - `functions/api/[[route]].ts`: `export const onRequest = handle(createApp())` from `hono/cloudflare-pages`.
  - `type AccessVerifier = (token: string, env: Env) => Promise<{ email: string }>`
  - `verifyAccessJwtWithJose: AccessVerifier`: jose `jwtVerify` against `createRemoteJWKSet(new URL(\`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs\`))`, with `audience: env.ACCESS_AUD` and `issuer: \`https://${env.ACCESS_TEAM_DOMAIN}\``. Cache the JWKS per isolate.
  - `requireEditor(verify: AccessVerifier): MiddlewareHandler<{ Bindings: Env; Variables: { editorEmail: string } }>`
  - `isEditor(email: string, allowlist: string): boolean`: comma-separated, trimmed, case-insensitive.
  - `GET /api/admin/me` returns `{ email }`.
  - Local dev: if `env.DEV_AUTH_EMAIL` is set, skip JWT and use it (still checked against the allowlist). It is only ever set in `.dev.vars`.

- [ ] **Step 1: Write failing tests:**

```ts
test('no Cf-Access-Jwt-Assertion header -> 401', ...);
test('verifier throws -> 401', ...);
test('valid token, email not in EDITOR_EMAILS -> 403', ...);
test('email match is case-insensitive', async () => { /* 'Ruchi@Example.com' -> 200 on /api/admin/me */ });
test('/api/admin/me returns the email', ...);
test('DEV_AUTH_EMAIL bypasses JWT but still enforces allowlist', ...);
```

- [ ] **Step 2: Run** `npm run test:server`. Expected: FAIL.
- [ ] **Step 3: Implement** `server/auth.ts`, `server/app.ts`, and the Pages entry. Tests call `createApp({ verifyAccessJwt: fakeVerifier(email) }).request(path, init, env)`; put `fakeVerifier(email)` (returns `async () => ({ email })`) in `tests/server/helpers.ts` for reuse.
- [ ] **Step 4: Run** `npm run test:server`. Expected: PASS.

---

### Task 4: Validation and public + write spot API

**Files:**
- Create: `server/validation.ts`
- Modify: `server/app.ts`
- Test: `tests/server/api-spots.test.ts`

**Interfaces:**
- Consumes: Task 2 repository, Task 3 `createApp` and `fakeVerifier`, `settings.ratingMax` from `src/config/settings.ts`.
- Produces:
  - `spotInputSchema` (zod) and `normalizeTags(tags: string[]): string[]`: trim, collapse inner whitespace, drop empties, case-insensitive dedupe keeping the first spelling, max 30 chars each.
  - Routes:
    - `GET /api/spots?status=&tag=` returns `SpotSummary[]`.
    - `GET /api/spots/:id` returns `Spot`, or 404 `{ error: 'not_found' }`.
    - `GET /api/tags` returns `string[]`.
    - `POST /api/admin/spots` takes `SpotInput` and returns 201 `Spot`.
    - `PUT /api/admin/spots/:id` returns `Spot`, or 404.
    - `DELETE /api/admin/spots/:id` returns 204 and deletes the R2 objects too.
  - Validation errors: 400 `{ error: 'invalid', issues }`.

- [ ] **Step 1: Write failing tests** using `createApp({ verifyAccessJwt: fakeVerifier('ruchi@example.com') })`; admin requests send header `Cf-Access-Jwt-Assertion: test`.

```ts
test('POST want with a rating is rejected', async () => {
  const r = await post('/api/admin/spots', { ...want, rating: 3 });
  expect(r.status).toBe(400);
});
test('POST been with rating 6 or 0 is rejected; rating null is allowed', ...);
test('POST normalizes tags', async () => {
  const s = await (await post('/api/admin/spots', { ...been, tags: [' dumplings ', 'Dumplings', 'Fully  veg menu', ''] })).json();
  expect(s.tags).toEqual(['dumplings', 'Fully veg menu']);
});
test('want spot: visitedOn must be null', ...);          // 400 if set
test('lat/lng out of range or name empty -> 400', ...);
test('PUT switching been->want while still sending a rating -> 400', ...);
test('PUT switching been->want when the spot has photos returns 409', ...);
test('PUT want->been ("I went!") with rating 5 succeeds', ...);
test('GET /api/spots/:id unknown -> 404', ...);
test('DELETE removes spot and its R2 objects', async () => {
  // put 'spots/<id>/p1.jpg' in env.PHOTOS + addPhoto row, DELETE, expect env.PHOTOS.get(key) to be null
});
test('notes containing <script> round-trip unchanged as data', ...);
test('public GET /api/spots needs no auth header', ...);
```

- [ ] **Step 2: Run** `npm run test:server`. Expected: FAIL.
- [ ] **Step 3: Implement `server/validation.ts`** with these rules:
  - `name`: 1 to 120 chars, trimmed.
  - `address`: string up to 300 chars, or null.
  - `lat`: -90 to 90. `lng`: -180 to 180.
  - `rating`: integer from 1 to `settings.ratingMax`, or null. Must be null when status is `want`.
  - `visitedOn`: `YYYY-MM-DD` or null. Must be null when status is `want`.
  - `notes`: up to 5000 chars, default `''`.
  - `tags` go through `normalizeTags`.
- [ ] **Step 4: Implement the routes** in `server/app.ts`.
- [ ] **Step 5: Run** `npm run test:server`. Expected: PASS.

---

### Task 5: Photos (upload, serve, delete)

**Files:**
- Modify: `server/app.ts`
- Test: `tests/server/api-photos.test.ts`

**Interfaces:**
- Consumes: `addPhoto`, `deletePhoto`, `getPhotoKey`, `countPhotos`, `getSpot`.
- Produces:
  - `POST /api/admin/spots/:id/photos`: body is the raw image bytes. Accepts `Content-Type` `image/jpeg`, `image/png`, or `image/webp`; headers `X-Photo-Width` and `X-Photo-Height` must be positive integers. Stores to R2 at `spots/<spotId>/<photoId>.<ext>` and returns 201 `Photo`.
  - `GET /api/photos/:photoId` returns the bytes with the stored content type and `Cache-Control: public, max-age=31536000, immutable`, or 404.
  - `DELETE /api/admin/photos/:photoId` returns 204 and removes the R2 object.

- [ ] **Step 1: Write failing tests:**

```ts
test('upload to been spot stores in R2 and returns Photo with /api/photos/<id> url', ...);
test('upload to want spot -> 409', ...);
test('upload to missing spot -> 404', ...);
test('non-image content type -> 400', ...);
test('body over settings.photoMaxBytes -> 413', ...);
test('missing or non-numeric X-Photo-Width -> 400', ...);
test('GET photo returns bytes, content type and immutable cache header', ...);
test('DELETE photo removes R2 object and row; spot photos list shrinks', ...);
test('upload without auth -> 401', ...);
```

- [ ] **Step 2: Run** `npm run test:server`. Expected: FAIL.
- [ ] **Step 3: Implement.** Check `Content-Length` first, then the actual byte length (the header can lie). Set `position = countPhotos`.
- [ ] **Step 4: Run** `npm run test:server`. Expected: PASS.

---

### Task 6: Place search proxy (Photon, switchable to Google)

**Files:**
- Create: `server/search.ts`
- Modify: `server/app.ts`
- Test: `tests/server/search.test.ts`

**Interfaces:**
- Produces:
  - `searchPlaces(q: string, near: { lat: number; lng: number } | null, env: Env, fetchFn: typeof fetch): Promise<PlaceResult[]>` dispatches on `env.SEARCH_PROVIDER`.
  - `photonSearch(...)`: `GET https://photon.komoot.io/api/?q=<q>&limit=8&lat=<lat>&lon=<lng>`. Map GeoJSON features to `PlaceResult`: `name` comes from `properties.name`; `address` joins `housenumber street, city, state`, or is null when none of those are present.
  - `googleSearch(...)`: Places API (New) Text Search `POST https://places.googleapis.com/v1/places:searchText` with `X-Goog-Api-Key: env.GOOGLE_PLACES_KEY` and field mask `places.displayName,places.formattedAddress,places.location`, plus `locationBias` when `near` is set.
  - `GET /api/admin/search?q=&lat=&lng=` returns `PlaceResult[]`. It is admin-only so the public can't burn quota.

- [ ] **Step 1: Write failing tests** with an injected `fetchFn` stub:

```ts
test('q shorter than settings.searchMinChars returns [] without calling fetch', ...);
test('photon response maps to PlaceResult with joined address', ...);
test('photon feature without street/city -> address null', ...);
test('lat/lng passed through as location bias', ...);       // inspect stub's URL
test('SEARCH_PROVIDER=google calls Places Text Search with the key header', ...);
test('provider HTTP error -> route returns 502 { error: "search_failed" }', ...);
```

- [ ] **Step 2: Run** `npm run test:server`. Expected: FAIL.
- [ ] **Step 3: Implement.** Set a `User-Agent: dumplings-map` header for Photon.
- [ ] **Step 4: Run** `npm run test:server`. Expected: PASS.

---

### Task 7: Rich link previews for `/spot/:id`

**Files:**
- Create: `server/preview.ts`, `functions/spot/[id].ts`
- Modify: `src/config/text.ts` (add `preview.defaultDescription`, `preview.wantToGo`)
- Test: `tests/server/preview.test.ts`

**Interfaces:**
- Consumes: `getSpot`, `text`, `settings.ratingMax`.
- Produces:
  - `buildPreviewTags(spot: Spot | null, origin: string): string` returns escaped `<meta property="og:...">` tags plus `twitter:card`.
  - `og:title` is `"<spot.name> · <text.appTitle>"`, or just `text.appTitle` when the spot is null.
  - `og:description` for a `been` spot is the rating as dumpling emoji (`'🥟'.repeat(rating)`), then ` <rating>/<ratingMax>`, then the first 150 chars of notes. For a `want` spot it is `text.preview.wantToGo` plus the notes snippet. For null it is `text.preview.defaultDescription`.
  - `og:image` is the absolute URL of the first photo (`<origin>/api/photos/<id>`), omitted when there is none.
  - `og:url` is `<origin>/spot/<id>`.
  - `escapeHtml(s: string): string`
  - `functions/spot/[id].ts`: `onRequestGet` fetches `env.ASSETS.fetch(new URL('/', request.url))`, then uses `HTMLRewriter` to append `buildPreviewTags` to `<head>` and to replace `<title>`. It always returns 200 with the app HTML.

- [ ] **Step 1: Write failing tests:**

```ts
test('been spot: title, rating description, absolute og:image', () => {
  const html = buildPreviewTags(spotWithPhoto, 'https://dumplings.example.com');
  expect(html).toContain('content="Golden Steamer · Ruchi&#39;s Dumpling Map"');
  expect(html).toContain('🥟🥟🥟🥟 4/5');
  expect(html).toContain('content="https://dumplings.example.com/api/photos/p1"');
});
test('escapes quotes and tags in name and notes', () => {
  const html = buildPreviewTags({ ...spot, name: '"><script>x</script>' }, o);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&quot;&gt;&lt;script&gt;');
});
test('want spot uses text.preview.wantToGo and no rating', ...);
test('null spot uses defaults and no og:image', ...);
test('function: unknown id still returns 200 HTML with default tags', ...); // stub env.ASSETS.fetch
```

- [ ] **Step 2: Run** `npm run test:server`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:server`. Expected: PASS.

---

### Task 8: Web API client, editor check, geo helpers, rating component

**Files:**
- Create: `src/lib/api.ts`, `src/lib/useEditor.ts`, `src/lib/geo.ts`, `src/components/DumplingRating.tsx`
- Test: `tests/web/geo.test.ts`, `tests/web/rating.test.tsx`, `tests/web/useEditor.test.tsx`

**Interfaces:**
- Produces:
  - `api`:
    - `listSpots(f: SpotFilter): Promise<SpotSummary[]>`
    - `getSpot(id): Promise<Spot | null>` (null on 404)
    - `listTags(): Promise<string[]>`
    - `createSpot(i: SpotInput): Promise<Spot>`
    - `updateSpot(id, i): Promise<Spot>`
    - `deleteSpot(id): Promise<void>`
    - `uploadPhoto(spotId, blob: Blob, w: number, h: number): Promise<Photo>`
    - `deletePhoto(id): Promise<void>`
    - `searchPlaces(q, near): Promise<PlaceResult[]>`
    - `me(): Promise<{ email: string } | null>`, which uses `redirect: 'manual'` and treats any non-200 or opaque redirect as signed out.
  - On a non-2xx response, the client throws `ApiError { status: number; code: string }`.
  - `useEditor(): { email: string | null; loading: boolean }`
  - `distanceMiles(a: LatLng, b: LatLng): number` (haversine) and `formatDistance(miles: number | null): string`. The formatter returns `''` for null and one decimal under 10 (`'0.4 mi'`), whole miles at 10 or more (`'12 mi'`). The unit label comes from `text`.
  - `<DumplingRating value: number | null; onChange?: (v: number) => void; size?: 'sm' | 'lg' />`. It renders `settings.ratingMax` icons from `icons.rating`, with filled ones at full opacity and the rest faded. With `onChange` each icon is a button whose aria-label is `text.rating.setLabel(n)`. Without it, the component is a single `img` role with `aria-label` `text.rating.valueLabel(value)`.

- [ ] **Step 1: Write failing tests:**

```ts
test('distanceMiles Houston downtown to Rice Village ~ 4 mi', () =>
  expect(distanceMiles({lat:29.7604,lng:-95.3698},{lat:29.7174,lng:-95.4136})).toBeCloseTo(3.9, 0));
test('formatDistance', () => {
  expect(formatDistance(null)).toBe('');
  expect(formatDistance(0.44)).toBe('0.4 mi');
  expect(formatDistance(12.3)).toBe('12 mi');
});
test('rating input: clicking 4th dumpling calls onChange(4)', ...);
test('rating display: 3 of 5 filled, labelled', ...);
test('useEditor: me() 200 -> email; opaque redirect -> null', ...); // mock fetch
```

- [ ] **Step 2: Run** `npm run test:web`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:web`. Expected: PASS.

---

### Task 9: Home screen: map, filters, drawer, feed

**Files:**
- Create: `src/components/MapView.tsx`, `src/components/FilterBar.tsx`, `src/components/SpotDrawer.tsx`, `src/components/SpotCard.tsx`
- Modify: `src/pages/HomePage.tsx`, `src/config/text.ts`
- Test: `tests/web/home.test.tsx`

**Interfaces:**
- Consumes: `api.listSpots`, `api.listTags`, `useEditor`, `DumplingRating`, geo helpers.
- Produces:
  - `HomePage`: state `{ view: 'map' | 'feed'; showBeen: boolean; showWant: boolean; tag: string | null }`, mirrored in the URL query (`?view=feed&tag=Momos`) so a filtered view can be shared.
  - `<MapView spots: SpotSummary[]; onSelect: (id: string) => void />`: MapLibre with `settings.mapStyleUrl`, `settings.defaultCenter`, and `settings.defaultZoom`. Markers are HTML elements using `icons.pinBeen` and `icons.pinWant`. Fit bounds to the spots when there are any. `HomePage` lazy-loads it (`React.lazy`) so tests never touch WebGL.
  - `<FilterBar ... />`: Been and Want-to-go chips (both on by default) and a tag dropdown (`text.filters.allFoods` plus `listTags()`).
  - `<SpotDrawer spots userLocation />`: a bottom sheet with a collapsed peek and an expanded list. Each row is a `SpotCard variant="row"`.
  - `<SpotCard spot variant: 'row' | 'card' distance?: string />`. The `row` variant is the drawer row from the mockup. The `card` variant is the feed photo card (shows `text.wantToGo` with no photo for want spots). Tapping either navigates to `/spot/:id`.
  - The Map/Feed toggle switches the view. The feed is a list of `SpotCard variant="card"`.
  - A "+" floating button links to `/admin/new`, rendered only when `useEditor().email` is set. The menu has `text.signIn` linking to `/admin` when signed out.
  - User location comes from `navigator.geolocation` once. If it is denied, distances are hidden.
  - Empty state: show `text.empty.noSpots`.

- [ ] **Step 1: Write failing tests** (mock `api`, stub `MapView`):

```ts
test('feed view lists spots newest first as cards', ...);
test('turning off Want-to-go chip hides want spots', ...);
test('tag dropdown filters and writes ?tag= to URL', ...);
test('+ button only when signed in', ...);
test('want spot card shows text.wantToGo and no rating', ...);
test('geolocation denied: no distance text rendered', ...);
test('no spots: shows text.empty.noSpots', ...);
```

- [ ] **Step 2: Run** `npm run test:web`. Expected: FAIL.
- [ ] **Step 3: Implement**, matching the layout of `.superpowers/brainstorm/*/content/map-and-add-v3.html` screen 1. Use theme classes only.
- [ ] **Step 4: Run** `npm run test:web`. Expected: PASS. Then check manually with `npm run dev:api` + `npm run dev` in phone emulation: pins render, the drawer drags, and the toggle works.

---

### Task 10: Add / edit spot form

**Files:**
- Create: `src/pages/SpotFormPage.tsx`, `src/components/PlaceSearch.tsx`, `src/components/PhotoPicker.tsx`, `src/components/TagEditor.tsx`, `src/lib/image.ts`
- Modify: `src/config/text.ts`
- Test: `tests/web/spot-form.test.tsx`, `tests/web/image.test.ts`

**Interfaces:**
- Consumes: the `api.*` write and search methods, `DumplingRating`, `settings`.
- Produces:
  - `fitWithin(w: number, h: number, maxEdge: number): { width: number; height: number }`: never upscales, keeps aspect ratio, rounds.
  - `resizeImage(file: File): Promise<{ blob: Blob; width: number; height: number }>`: uses `createImageBitmap`, a canvas sized by `fitWithin(…, settings.photoMaxEdge)`, and `toBlob('image/jpeg', settings.photoQuality)`.
  - `SpotFormPage` is mounted at `/admin/new` and `/admin/spot/:id/edit?went=1`:
    - `PlaceSearch` debounces 300ms and calls `api.searchPlaces` (with the user's location as the bias). Picking a result fills name, address, lat and lng. A "drop a pin" option opens a small MapView where tapping sets lat and lng, and the name is then typed in by hand.
    - A status toggle offers Been there / Want to go. When Want to go is selected, the rating, visit date and photos fields are not rendered.
    - Visit date defaults to today for `been`.
    - `TagEditor` suggests `settings.defaultTags` plus `listTags()` and allows free text. A new spot starts with `settings.newSpotTags`.
    - `PhotoPicker` uses `<input type="file" accept="image/*" multiple>`. It shows thumbnails, lets her remove a picked or existing photo, and resizes each photo on pick.
    - On save, the form creates or updates the spot, then uploads the new photos one at a time, then deletes the removed ones, then navigates to `/spot/:id`.
    - If a photo upload fails, the form shows `text.form.photoUploadFailed` and stays on the edit page with a retry option. The spot itself is already saved.
    - `?went=1` (the "I went!" flow) opens the form with status `been`, today's date, and focus on the rating.
    - The edit page offers no been to want switch when the spot has photos.
    - Delete asks for confirmation (`text.form.confirmDelete`), then calls `api.deleteSpot` and navigates to `/`.

- [ ] **Step 1: Write failing tests:**

```ts
test('fitWithin', () => {
  expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
});
test('want to go hides rating, date and photos', ...);
test('saving a want spot sends rating null and visitedOn null', ...);
test('picking a search result fills name/address/lat/lng', ...);
test('save creates spot, uploads photos in order, then navigates', ...);
test('photo upload failure shows error and stays on page', ...);
test('?went=1 preselects Been there with today\'s date', ...);
test('save disabled until a place (lat/lng) and name are set', ...);
```

- [ ] **Step 2: Run** `npm run test:web`. Expected: FAIL.
- [ ] **Step 3: Implement**, matching `map-and-add-v3.html` screens 2 and 3.
- [ ] **Step 4: Run** `npm run test:web`. Expected: PASS. Then verify manually on a real phone (on the same Wi-Fi, run `vite --host`): add a spot with 2 camera photos, and confirm each R2 object is under 1 MB.

---

### Task 11: Spot page

**Files:**
- Create: `src/pages/SpotPage.tsx`, `src/components/PhotoCarousel.tsx`
- Modify: `src/config/text.ts`
- Test: `tests/web/spot-page.test.tsx`

**Interfaces:**
- Consumes: `api.getSpot`, `useEditor`, `DumplingRating`.
- Produces:
  - `SpotPage`:
    - Shows a swipeable `PhotoCarousel` (CSS scroll-snap, dot indicators), the name, address, and visit date (formatted with `Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })`), plus `DumplingRating` (been spots only), tags, and notes (with line breaks kept).
    - The Directions button links to `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`, which opens the phone's maps app.
    - The Share button uses `navigator.share({ title, url })` when available. Otherwise it copies the URL and shows `text.spot.linkCopied`.
    - When signed in, it shows Edit (links to `/admin/spot/:id/edit`). A want spot also gets an "I went!" button that links to `/admin/spot/:id/edit?went=1`.
    - Missing spot: shows `text.notFound` and a link back to the map.

- [ ] **Step 1: Write failing tests:**

```ts
test('been spot shows rating, notes, tags, formatted date', ...);
test('want spot shows no rating and, when signed in, an I went! link to ?went=1', ...);
test('unknown id shows text.notFound', ...);
test('share falls back to clipboard when navigator.share is missing', ...);
test('Edit/I went! hidden when signed out', ...);
```

- [ ] **Step 2: Run** `npm run test:web`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:web`. Expected: PASS.

---

### Task 12: Deploy, Access setup, and end-to-end check

**Files:**
- Create: `README.md`
- Modify: `CLAUDE.md` (link the README's deploy section)

- [ ] **Step 1: Write `README.md`** with these sections:
  - **Local dev:** `npm i`, copy `.dev.vars.example` to `.dev.vars`, `npm run db:migrate:local`, `npm run build`, `npm run dev:api` and `npm run dev`.
  - **Cloudflare setup:** `wrangler d1 create dumplings`, then put the id in `wrangler.toml`. Run `wrangler r2 bucket create dumplings-photos`, `wrangler d1 migrations apply dumplings --remote`, and create the Pages project. Connect the custom domain from the owner's Cloudflare zone.
  - **Access:** in Zero Trust, create a self-hosted application covering `<domain>/admin` and `<domain>/api/admin`, with an Allow policy for the two emails and the One-time PIN login method. Copy the team domain and the AUD tag into the Pages env vars, and set `EDITOR_EMAILS`.
  - **Switching search to Google:** set `SEARCH_PROVIDER=google`, add `GOOGLE_PLACES_KEY` as a secret, and set a billing budget alert and quota cap.
  - **Changing text, colors, icons and settings:** a table that maps each to its file.
- [ ] **Step 2: Deploy** with `npm run build && wrangler pages deploy dist`. This needs the owner's Cloudflare login; ask them to run `wrangler login` if needed.
- [ ] **Step 3: End-to-end check on the live URL from a phone:**
  - Browsing signed out works and shows no "+".
  - `/admin` prompts for the email code.
  - After sign-in, add a been spot with photos and a want spot.
  - "I went!" converts the want spot.
  - Texting a spot link shows a preview with the photo.
  - `curl -I` shows `X-Robots-Tag: noindex`.
  - `curl -X POST <domain>/api/admin/spots` without auth returns 401 or an Access redirect.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
