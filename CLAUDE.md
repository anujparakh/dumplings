# Ruchi's Dumpling Map

## Goal

"Ruchi's Dumpling Map" is a public, mobile-first web map of Ruchi's vegetarian dumpling spots. Ruchi (and the repo owner) sign in to pin spots, rate them (1 to 5 dumplings), write notes, and add photos, usually from a phone while at the restaurant. Spots are either "Been there" (reviewed, with rating, photos, notes, visit date) or "Want to go" (notes and tags only, can be switched to "Been there" later). Anyone with the link can browse. The app is dumpling-first but grows to other foods through tags: a new food is a new tag, not a code change. Default map view is Houston; distances are in miles.

## Key rules

- **Mobile first.** Adding a spot at the table must be quick and easy on a phone.
- **Free to host on Cloudflare** (free tier, owner's existing domain). Nothing that costs money at this scale.
- **Only Ruchi and the owner can edit.** The public can browse without an account. Writes and editing routes require sign-in.
- **Nothing user-facing is hard-coded in components.** These live in dedicated files, separate from component code:
  - Text: all user-facing strings (title, labels, placeholders, empty states, rating labels) in one text/content file.
  - Theme: colors, fonts, radii, spacing as CSS variables in one theme file, mapped into Tailwind. Components use semantic classes (e.g. `bg-primary`), never raw colors.
  - Icons and images: rating icon, pin icons, logo, per-tag icons in one assets folder, referenced by name from one config.
  - Settings: rating scale, default map location and zoom, starting tags, place search provider, noindex flag in one config file.
  - Changing any of these must not require touching component code.
- Site is reachable by link but hidden from search engines (noindex) by default, controlled by one setting.
- Shared spot links need rich previews (photo, name, rating), rendered server-side per spot.
- Adding and editing require a connection. No offline support.

## Tech stack

- TypeScript throughout.
- Frontend: React + Vite, styled with Tailwind CSS (theme via CSS variables).
- Map: MapLibre GL with OpenFreeMap tiles (free, no API key).
- Place search: Photon (OpenStreetMap-based typeahead), behind a provider setting that can switch to Google Places later.
- Backend: Hono on Cloudflare Pages Functions.
- Data: Cloudflare D1. Photos: Cloudflare R2 (resized on the phone before upload).
- Sign-in: Cloudflare Access (one-time email code) guarding only editing routes and the write API.

## Out of scope for now

- Importing Google Maps saved places.
- Per-dish reviews.
- Visit history (multiple dated visits per spot). Keep the data model open to adding it later.
- Offline drafts or upload queues.
- Public accounts, comments, or ratings. Final custom icons (placeholders for now).

## Docs

- Design doc: `docs/superpowers/specs/2026-10-30-dumpling-map-design.md` (source of truth for scope and decisions).
- Implementation plan will live in `docs/superpowers/plans/`.
- `README.md`: owner-facing guide for running locally, deploying to Cloudflare, setting up Access, and changing text, theme, icons, and settings.
- Mockups: `.superpowers/brainstorm/*/content/` (`map-and-add-v3.html` is the latest).

## Commands

See `README.md` for the full local-run and deploy steps (wrangler needs Node 22+).

- `npm run dev`: Vite dev server (proxies `/api` to `http://localhost:8788`). Link previews (`/spot/:id` meta tags) are tested on :8788 directly.
- `npm run dev:api`: `wrangler pages dev dist --port 8788` (run `npm run build` first).
- `npm run build`: type-check and build to `dist/`.
- `npm run test:web`: frontend tests (Vitest + jsdom).
- `npm run test:server`: Pages Functions tests (config added with the server tasks).
- `npm test`: both test suites.
- `npm run db:migrate:local`: apply D1 migrations locally.
