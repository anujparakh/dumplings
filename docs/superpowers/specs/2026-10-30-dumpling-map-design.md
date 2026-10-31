# Ruchi's Dumpling Map: Design

Date: 2026-10-30

## Intent

Ruchi is a huge fan of vegetarian dumplings. She finds and tries them everywhere. Today that knowledge is scattered: photos in her camera roll, favorite spots saved in Google Maps, and stories she tells friends. This app puts it in one place: a public map of her dumpling spots, with her reviews and photos, that she can point anyone to.

It is built by a friend (the owner of this repo) for her. It is dumpling-first, but should be able to cover other foods without a rebuild.

## Goals

- A public, mobile-first web app showing Ruchi's spots on a map. Anyone with the link can browse, no account needed.
- Ruchi (and the repo owner) can sign in and add, edit, and delete spots from a phone, typically while standing in the restaurant.
- Two kinds of spots:
  - **Been there:** reviewed, with a rating, photos, notes, and visit date.
  - **Want to go:** a place she plans to try. No rating, no photos. Can be turned into "Been there" later.
- Reviews are for the restaurant as a whole. One review per spot for now; editing it replaces it. A visit history (multiple dated visits per spot, each with its own rating, photos, notes) is a planned future feature, so the data model should not make it hard to add.
- Adding and editing requires a working connection. No offline drafts or upload queues.
- Shared spot links show a rich preview (photo, name, rating) in message apps. Spot pages therefore need per-spot preview tags rendered server-side (e.g. a Cloudflare Pages Function), since message apps don't run JavaScript.
- Location: Ruchi is in Houston, and spots will mostly be in the USA. Default map view is Houston; distances in miles.
- Free to host, on the owner's existing Cloudflare domain.
- Every piece of text, color, icon, and design element is easy to change in one place (see "Easy to change" below). The owner expects to change their mind on look and wording.

## Non-goals (for now)

- Importing her Google Maps saved places. Planned for later; she starts fresh.
- Reviews of individual dishes. Possible future add-on.
- Final custom icons. Placeholders now; the owner will pick real ones later.
- Accounts, comments, or ratings from the public.

## Anti-goals

- Anything that costs money to run at her scale (a handful of users editing, low public traffic).
- Clunky phone experience. If adding a spot at the table is fiddly, she won't use it.
- Wording, colors, or icons hard-coded throughout the code so that a change of mind means hunting through files.

## Screens

Mockups from the brainstorming session are in `.superpowers/brainstorm/*/content/` (`map-and-add-v3.html` is the latest).

### Main map (home)

- Full-screen map with pins. "Been there" and "Want to go" pins look different (solid vs outlined in the mockup).
- Title bar: "Ruchi's Dumpling Map" and a menu.
- Filter chips: Been / Want to go, and a food-type (tag) filter.
- A Map / Feed switch.
- Pull-up drawer listing spots (thumbnail, name, dumpling rating, distance, a snippet of notes; "Want to go" spots show that label instead of a rating).
- A "+" button to add a spot, visible only when signed in.

### Feed view

- Alternative to the map: a scrolling list of photo cards, newest first (name, rating, date, notes snippet). Want-to-go spots appear as cards with no photo.
- Same filters as the map.

### Spot page

- Photos (swipeable), name, address, visit date, dumpling rating (1 to 5), tags, free-form notes.
- Directions button (opens the phone's maps app) and Share button.
- Each spot has its own stable link so she can text someone one place.
- Want-to-go spots show name, location, notes, and tags only, plus an "I went!" button (signed in only) that switches it to Been there and opens the review fields.
- Edit / delete when signed in.

### Add / edit spot

- Search for the restaurant by name with suggestions, or drop a pin on the map.
- Choose Been there / Want to go.
- Been there: rating (tap 1 to 5 dumplings), photos (add several from camera or library), notes, tags.
- Want to go: notes and tags only. Rating and photos are hidden.
- Save.

## Ratings

1 to 5, shown as dumpling icons instead of stars. The icon is a placeholder and must be swappable in one place.

## Food types / tags

Each spot has tags, e.g. "Dumplings", "Fully veg menu". The food-type filter on the map uses them. This is how the app grows to other foods: a new food is just a new tag, no code change. Dumplings stays the default and the star of the branding.

## Easy to change (owner requirement)

The owner may change their mind on wording and look, so these must live in dedicated, clearly named places, separate from the app logic:

- **Text:** all user-facing strings (title, button labels, placeholder text, empty states, rating labels) in one text/content file.
- **Theme:** colors, fonts, corner radius, spacing in one theme file (e.g. CSS variables / design tokens). No colors hard-coded in components.
- **Icons and images:** rating icon, pin icons (been / want to go), logo, and any per-tag icons in one assets folder, referenced by name from one config.
- **Settings:** things like the rating scale, default map location and zoom, and the starting list of tags in one config file.

Changing any of the above should not require touching component code.

## How it gets made (owner's constraints, builder's calls marked)

- **Hosting:** Cloudflare free tier on the owner's Cloudflare domain. (Owner's constraint.)
- **Builder's calls (proposed in brainstorming, owner did not object):**
  - Cloudflare Pages for the site, D1 for spot data, R2 for photos.
  - Backend: Cloudflare Pages Functions (Workers) in the same project. Responsibilities:
    - A JSON API to list, read, create, update, and delete spots (writes require sign-in).
    - Sign-in and session checks, allowing only Ruchi's and the owner's emails.
    - Accepting photo uploads into R2 (and deleting them with their spot), plus serving them.
    - Server-rendering per-spot preview tags so shared links show a rich preview.
    - Proxying place search if the chosen provider needs a secret key (e.g. Google later), so keys never reach the browser.
  - Free map tiles and a free place search (e.g. OpenStreetMap-based), not Google, to avoid needing a billing account.
- **Owner's decision:** the place search sits behind one config setting so it can be switched to Google Places later if free search is poor for Houston restaurants. The map display stays on free tiles either way.
  - Sign-in by email limited to Ruchi's and the owner's addresses; nobody else can sign in. Exact mechanism left to the builder, as long as it's free and works well on a phone.
  - Photos are resized on the phone before upload to keep storage free and uploads fast.
  - Placeholder dumpling icons until the owner picks real ones.
  - Reachable by link but hidden from search engines (noindex), since it carries Ruchi's name and where she eats. One setting to flip if the owner wants it indexed.

## Tech stack (owner approved)

- TypeScript throughout.
- Frontend: React + Vite, styled with Tailwind CSS. Theme colors/fonts/radii are defined as CSS variables in the theme file and mapped into Tailwind's theme, so components use semantic classes (e.g. `bg-primary`) and never raw colors.
- Map: MapLibre GL with OpenFreeMap tiles (free, no API key).
- Place search: Photon (OpenStreetMap-based, supports typeahead), behind a provider setting that can switch to Google Places later.
- Backend: Hono on Cloudflare Pages Functions.
- Data: Cloudflare D1. Photos: Cloudflare R2.
- Sign-in: Cloudflare Access (free, one-time email code) guarding only the editing routes and write API; browsing stays public.

## Left to the builder

- Other libraries beyond the stack above.
- Exact data model, as long as it supports: spots with status (been / want to go), rating, notes, visit date, tags, multiple photos, location; and later additions of dishes and an import.
- Map library and tile/search provider choice within the free constraint.
- Visual polish within the mockups' layout.
- Testing approach.
