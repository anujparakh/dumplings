# Ruchi's Dumpling Map

A mobile-first web map of Ruchi's vegetarian dumpling spots. Anyone with the link can browse. Ruchi and the owner sign in to add spots, ratings, notes, and photos. Spots are "Been there" or "Want to go", and new foods are just new tags.

Stack: React + Vite + Tailwind, MapLibre (OpenFreeMap tiles), Hono on Cloudflare Pages Functions, D1 (database), R2 (photos), Cloudflare Access (sign-in).

## Prerequisites

- Node 22 or newer (wrangler requires it; Node 20 fails with "Wrangler requires at least Node.js v22.0.0") and npm. The repo has an `.nvmrc`, so with nvm just run `nvm use` (or `nvm install` the first time) in the project folder.
- A Cloudflare account with your domain on it (only needed to deploy).
- For deploying: `npx wrangler login` (opens a browser to authorize wrangler).

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your local env file:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   `DEV_AUTH_EMAIL` makes the API treat every request as that person, so you can add and edit spots locally without Cloudflare Access. It must be one of the `EDITOR_EMAILS`. The empty `ACCESS_TEAM_DOMAIN=` line overrides the `wrangler.toml` value locally: the API only honors `DEV_AUTH_EMAIL` when `ACCESS_TEAM_DOMAIN` is empty, so once Access is configured in production a stray `DEV_AUTH_EMAIL` is ignored. Still, never set `DEV_AUTH_EMAIL` in production. `.dev.vars` is gitignored.
3. Create the local database and apply migrations:
   ```bash
   npm run db:migrate:local
   ```
4. Build once (the API server serves the built `dist/` folder):
   ```bash
   npm run build
   ```
5. In two terminals, run the API and the web app:
   ```bash
   npm run dev:api   # terminal 1: API + /spot/:id link previews on http://localhost:8788
   npm run dev       # terminal 2: React app with hot reload on http://localhost:5173
   ```
6. Open http://localhost:5173. Vite proxies `/api` to port 8788.

Link previews (the `/spot/:id` meta tags) are tested on http://localhost:8788 directly, for example `curl http://localhost:8788/spot/<id>`. `dev:api` serves the built `dist`, so re-running `npm run build` only matters for those previews. The React app itself hot-reloads through Vite. Local data lives in `.wrangler/` (delete that folder to start fresh, then run step 3 again).

## Try it on your phone (same Wi-Fi)

```bash
npm run dev -- --host
```

Open the "Network" URL it prints (something like `http://192.168.1.20:5173`) on your phone, with `dev:api` still running.

Caveat: browsers only allow geolocation (and some camera behaviors) on HTTPS or localhost. Over a LAN IP, "near me" distance and centering the pin on your location will not work. Options:

- Test those parts on the deployed site (see below).
- Optional: use a tunnel that gives you an HTTPS URL, for example `cloudflared tunnel --url http://localhost:5173` (needs the `cloudflared` tool installed; Vite may also need `server.allowedHosts` set for the tunnel hostname).

## Run tests

```bash
npm test
```

(`npm run test:web` and `npm run test:server` run each half.)

## First-time deploy to Cloudflare

Run these from the project folder, after `npx wrangler login`.

1. Create the database, then copy the `database_id` it prints into `wrangler.toml` (replace `REPLACE_WITH_D1_ID`):
   ```bash
   npx wrangler d1 create dumplings
   ```
2. Create the photo bucket (the `PHOTOS` binding in `wrangler.toml` already points at it):
   ```bash
   npx wrangler r2 bucket create dumplings-photos
   ```
3. Apply migrations to the real database:
   ```bash
   npx wrangler d1 migrations apply dumplings --remote
   ```
4. Create the Pages project:
   ```bash
   npx wrangler pages project create dumplings --production-branch main
   ```
5. Build and deploy:
   ```bash
   npm run build && npx wrangler pages deploy dist --branch main
   ```
   The D1 and R2 bindings and the `[vars]` come from `wrangler.toml`. The site is now live at `https://dumplings.pages.dev` (the exact name is printed at the end).
6. Add your domain: Cloudflare dashboard > Workers & Pages > dumplings > Custom domains > Set up a custom domain. Pick a name on your Cloudflare domain (for example `dumplings.yourdomain.com`). DNS and HTTPS are set up for you.

At this point editing does not work yet: every edit API call returns 401 until Cloudflare Access is configured in the next section.

## Lock down editing with Cloudflare Access

Cloudflare Access (Zero Trust, free plan for up to 50 users) puts an email-code login in front of editing.

1. Dashboard > Zero Trust (first time: pick a team name and the Free plan; you may be asked for a payment method but the free plan is not charged). Your team domain is `<team>.cloudflareaccess.com`.
2. Zero Trust > Access > Applications > Add an application > Self-hosted.
3. Add two paths on your custom domain (Access needs the wildcard form):
   - `dumplings.yourdomain.com/admin*`
   - `dumplings.yourdomain.com/api/admin*`
4. Add an Allow policy with an Emails include rule listing Ruchi's email and yours.
5. Under login methods, enable One-time PIN.
6. Set the application's Session Duration to the maximum (1 month), so Ruchi is rarely signed out mid-edit. If a session does expire while she is filling in a spot, the form shows a "Sign in again" link that opens in a new tab; after signing in there she taps Save again and nothing is lost.
7. Save, then open the application and copy its Application Audience (AUD) tag.
8. Put the values in `wrangler.toml` under `[vars]`:
   ```toml
   [vars]
   SEARCH_PROVIDER = "photon"
   EDITOR_EMAILS = "ruchi@example.com,you@example.com"
   ACCESS_TEAM_DOMAIN = "yourteam.cloudflareaccess.com"
   ACCESS_AUD = "the-long-aud-tag"
   ```
   Then redeploy (`npm run build && npx wrangler pages deploy dist --branch main`). The team domain and AUD tag are identifiers, not secrets (the signature check is what protects you). The emails would be committed to the repo, so if the repo is public you may prefer to keep them out of it (see the note below).
9. The `*.pages.dev` URL serves the same app. Either add `dumplings.pages.dev/admin*` and `dumplings.pages.dev/api/admin*` as extra paths on the same Access application, or accept that editing there is rejected (the API checks the Access token, so it returns 401 without a login, which is safe; you just cannot sign in there).

Note on vars: because this project has a `wrangler.toml`, Cloudflare treats that file as the source of truth for Pages variables and bindings, and the dashboard's Settings > Variables for those are read-only. To keep `EDITOR_EMAILS` out of a public repo, remove that line from `[vars]` and store it as a secret instead (secrets are still managed outside the file):
```bash
npx wrangler pages secret put EDITOR_EMAILS
```
Secrets take effect on the next deployment.

## Updating later

```bash
npm run build && npx wrangler pages deploy dist --branch main
```

When a new file appears in `migrations/`, apply it before (or right after) deploying:

```bash
npx wrangler d1 migrations apply dumplings --remote
```

## Smoke test after deploying

1. In a private/incognito window, browse the site: the map and spots load and there is no "+" button.
2. Go to `/admin`: you are asked for your email, then a one-time code. After signing in, the "+" appears.
3. From your phone, add a "Been there" spot with photos, and a "Want to go" spot. Open the want spot and use "I went!".
4. Text a spot link to yourself: the preview shows the spot name, rating, and photo.
5. Check the site is hidden from search engines (expect `x-robots-tag: noindex`):
   ```bash
   curl -I https://dumplings.yourdomain.com/
   curl -I https://dumplings.yourdomain.com/spot/<id>
   ```
   Use a real spot id (from a shared link). Both responses must include `x-robots-tag: noindex`.
6. Check writes are blocked when signed out (expect 401, or a redirect to the Access login):
   ```bash
   curl -i -X POST https://dumplings.yourdomain.com/api/admin/spots
   ```
7. Real-device photo check: on Ruchi's phone, add a "Been there" spot with 2 photos taken with the camera. Then in the Cloudflare dashboard > R2 > `dumplings-photos`, confirm each new object is under 1 MB, and open each one to confirm it is the right way up (not rotated).

## Changing text, colors, icons, and settings

None of these need component changes.

| To change | Edit |
| --- | --- |
| Any wording (title, labels, placeholders, empty states, rating labels) | `src/config/text.ts` |
| Colors, fonts, radii, spacing | `src/theme/theme.css` |
| Which icon is used for rating, pins, logo, per-tag icons | `src/config/icons.ts` |
| The icon image files themselves | `public/icons/` (keep the filename, or update `icons.ts`) |
| Rating scale, default map location and zoom, starting tags, photo size limits, search settings | `src/config/settings.ts` |

Allow search engines: the site is hidden by default. Set `allowIndexing: true` in `src/config/settings.ts`, and also remove the three blockers it lists: the `<meta name="robots">` tag in `index.html`, the `X-Robots-Tag` line in `public/_headers`, and `Disallow: /` in `public/robots.txt`. Then redeploy.

## Switching place search to Google

Place search uses Photon (free, no key) by default. To use Google Places:

1. In Google Cloud, create a project, enable billing, and enable "Places API (New)". Create an API key.
2. Set a budget alert (Billing > Budgets and alerts) and a daily quota cap for the Places API (APIs and services > Places API (New) > Quotas) so a bug or abuse cannot run up a bill.
3. Store the key as a secret:
   ```bash
   npx wrangler pages secret put GOOGLE_PLACES_KEY
   ```
4. In `wrangler.toml`, change `SEARCH_PROVIDER = "photon"` to `SEARCH_PROVIDER = "google"` and redeploy.

## Troubleshooting

- `Wrangler requires at least Node.js v22.0.0`: upgrade Node (`nvm install 22 && nvm use 22`).
- 401 from `/api/admin/...` locally: `.dev.vars` is missing, lacks the empty `ACCESS_TEAM_DOMAIN=` line, or `dev:api` was started before you created it. Create it and restart `dev:api`.
- 403 from `/api/admin/...`: your email (`DEV_AUTH_EMAIL` locally, or your Access login in production) is not in `EDITOR_EMAILS`.
- D1 "no such table": run `npm run db:migrate:local` (local) or `npx wrangler d1 migrations apply dumplings --remote` (deployed).
- `/spot/:id` shows old content or 404 locally: re-run `npm run build`, then restart `dev:api`.
- Photos do not load or upload fails: check the R2 bucket exists (`npx wrangler r2 bucket list`) and the `PHOTOS` binding in `wrangler.toml` names it `dumplings-photos`; redeploy after changing `wrangler.toml`.
- Deployed site says unauthorized after signing in: `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is wrong or empty (no `https://`, exactly as shown in Zero Trust), or the Access paths do not cover `/api/admin*`. Redeploy after fixing.
- Sign-in loops or never prompts: the Access application paths must match the domain you are visiting (custom domain vs `pages.dev`), and your email must be in the Allow policy.
