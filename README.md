# Ruchi's Dumpling Map

A mobile-first web map of Ruchi's vegetarian dumpling spots. Anyone with the link can browse. Ruchi and the owner sign in to add spots, ratings, notes, and photos. Spots are "Been there" or "Want to go", and new foods are just new tags.

Stack: React + Vite + Tailwind, MapLibre (OpenFreeMap tiles), Hono on Cloudflare Pages Functions, D1 (database), R2 (photos). Editing is unlocked with one shared password.

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
   It sets the local editor password (`EDITOR_PASSWORD=dev`). To add or edit spots locally, tap the menu > Sign in and enter it. `.dev.vars` is gitignored.
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

Caveat: browsers only allow geolocation (and some camera behaviors) on HTTPS or localhost, and the sign-in cookie is HTTPS-only too. Over a LAN IP you can browse, but you cannot sign in, and "near me" distance and centering the pin on your location will not work. Options:

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

At this point editing does not work yet: every edit API call returns 401 until you set a password in the next section.

## Set the editor password

Editing is unlocked with one password that you and Ruchi share. Anyone can browse without it.

1. Pick a long password, for example four random words (`velvet-lantern-pickle-harbor`). Anyone can try guessing, so length matters more than symbols.
2. Save it as a secret (paste it when asked):
   ```bash
   npx wrangler pages secret put EDITOR_PASSWORD
   ```
3. Redeploy so the secret takes effect:
   ```bash
   npm run build && npx wrangler pages deploy dist --branch main
   ```
4. On the site, tap the menu > Sign in and enter the password. Each phone stays signed in for 90 days (`signInDays` in `src/config/settings.ts`). If a sign-in expires while she is filling in a spot, the form shows a "Sign in again" link that opens in a new tab; after signing in there she taps Save again and nothing is lost.
5. Recommended: slow down password guessing with Cloudflare's free rate limiting. Dashboard > your domain > Security > WAF > Rate limiting rules > Create rule:
   - If incoming requests match: URI Path equals `/api/login`
   - Rate: 5 requests per 10 seconds, counted per IP
   - Action: Block for 10 seconds

   This only covers your custom domain, not `dumplings.pages.dev`.

To change the password, run step 2 again with the new one and redeploy. Every phone is signed out and needs the new password, which is also how you lock someone out.

## Updating later

```bash
npm run build && npx wrangler pages deploy dist --branch main
```

When a new file appears in `migrations/`, apply it before (or right after) deploying:

```bash
npx wrangler d1 migrations apply dumplings --remote
```

## Auto-deploy from GitHub

`.github/workflows/deploy.yml` runs on every push to `main`. It runs the tests, builds, applies new migrations, and deploys, which is the same as the manual steps above. If the tests fail, nothing is deployed. You can also start it by hand from the repo's Actions tab ("Deploy" > "Run workflow").

One-time setup:

1. Create an API token: Cloudflare dashboard > My Profile > API Tokens > Create Token > Create Custom Token. Add these permissions:
   - Account > Cloudflare Pages > Edit
   - Account > D1 > Edit

   Under Account Resources, pick your account. Create it and copy the token (it is shown only once).
2. Find your account ID: Cloudflare dashboard > Workers & Pages. It is in the right sidebar (or run `npx wrangler whoami`).
3. In GitHub: repo > Settings > Secrets and variables > Actions > New repository secret. Add:
   - `CLOUDFLARE_API_TOKEN`: the token from step 1
   - `CLOUDFLARE_ACCOUNT_ID`: the ID from step 2
4. Push to `main` (or run the workflow by hand) and watch the Actions tab.

`EDITOR_PASSWORD` stays a Cloudflare secret, so the workflow never needs or changes it. The manual commands above still work if you ever need to deploy from your machine.

## Smoke test after deploying

1. In a private/incognito window, browse the site: the map and spots load and there is no "+" button.
2. Tap the menu > Sign in and enter the password. After signing in, the "+" appears.
3. From your phone, add a "Been there" spot with photos, and a "Want to go" spot. Open the want spot and use "I went!".
4. Text a spot link to yourself: the preview shows the spot name, rating, and photo.
5. Check the site is hidden from search engines (expect `x-robots-tag: noindex`):
   ```bash
   curl -I https://dumplings.yourdomain.com/
   curl -I https://dumplings.yourdomain.com/spot/<id>
   ```
   Use a real spot id (from a shared link). Both responses must include `x-robots-tag: noindex`.
6. Check writes are blocked when signed out (expect 401):
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

Place search uses Photon (free, no key) by default. To switch to Google Places, follow [docs/switch-to-google.md](docs/switch-to-google.md).

## Troubleshooting

- `Wrangler requires at least Node.js v22.0.0`: upgrade Node (`nvm install 22 && nvm use 22`).
- 401 from `/api/admin/...`: you are not signed in (menu > Sign in). Locally, `.dev.vars` must exist with `EDITOR_PASSWORD` before `dev:api` starts.
- Sign-in fails with "Couldn't sign in": `EDITOR_PASSWORD` is not set (the API returns 503). Set the secret and redeploy, or restart `dev:api` after editing `.dev.vars`.
- Sign-in works but you are immediately signed out again: you are on plain `http://` other than localhost (the cookie is HTTPS-only). Use the deployed site or localhost.
- D1 "no such table": run `npm run db:migrate:local` (local) or `npx wrangler d1 migrations apply dumplings --remote` (deployed).
- `/spot/:id` shows old content or 404 locally: re-run `npm run build`, then restart `dev:api`.
- Photos do not load or upload fails: check the R2 bucket exists (`npx wrangler r2 bucket list`) and the `PHOTOS` binding in `wrangler.toml` names it `dumplings-photos`; redeploy after changing `wrangler.toml`.
