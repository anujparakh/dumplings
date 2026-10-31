// App-wide settings. Components import from this file instead of using magic values.
export const settings = {
  // Changing ratingMax also needs a migration: the DB has CHECK (rating BETWEEN 1 AND 5).
  ratingMax: 5,
  defaultCenter: { lat: 29.7604, lng: -95.3698 }, // Houston
  defaultZoom: 11,
  defaultTags: ['Dumplings', 'Fully veg menu'],
  newSpotTags: ['Dumplings'],
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  // When fitting the map to spots: never zoom in past this, and keep pins clear of the
  // floating header (top) and the spot drawer (bottom). Values are pixels.
  mapFitMaxZoom: 14,
  mapFitPadding: { top: 140, bottom: 120, left: 72, right: 72 },
  // Name labels under the pins hide when zoomed out further than this, so a city-wide view stays tidy.
  pinLabelMinZoom: 8,
  photoMaxEdge: 1600,
  photoQuality: 0.82,
  photoMaxBytes: 5_000_000,
  searchMinChars: 3,
  searchDebounceMs: 300,
  // Street-level zoom for the "drop a pin" map when it opens at a known place or her location.
  pinZoom: 17,
  // Days a sign-in lasts on a device before the password is asked for again.
  signInDays: 90,
  // Directions open Apple Maps on iPhone/iPad and Google Maps everywhere else (see src/lib/directions.ts).
  directionsUrl: (lat: number, lng: number): string =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  appleDirectionsUrl: (lat: number, lng: number): string => `https://maps.apple.com/?daddr=${lat},${lng}`,
  // Indexing is blocked in three places: the <meta name="robots"> tag in index.html,
  // the X-Robots-Tag header in public/_headers, and Disallow in public/robots.txt.
  allowIndexing: false,
} as const;
