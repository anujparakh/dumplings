// App-wide settings. Components import from this file instead of using magic values.
export const settings = {
  ratingMax: 5,
  defaultCenter: { lat: 29.7604, lng: -95.3698 }, // Houston
  defaultZoom: 11,
  distanceUnit: 'mi',
  defaultTags: ['Dumplings', 'Fully veg menu'],
  newSpotTags: ['Dumplings'],
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  // When fitting the map to spots: never zoom in past this, and keep pins clear of the
  // floating header (top) and the spot drawer (bottom). Values are pixels.
  mapFitMaxZoom: 14,
  mapFitPadding: { top: 140, bottom: 260, left: 40, right: 40 },
  photoMaxEdge: 1600,
  photoQuality: 0.82,
  photoMaxBytes: 5_000_000,
  searchMinChars: 3,
  searchDebounceMs: 300,
  // Indexing is blocked in three places: the <meta name="robots"> tag in index.html,
  // the X-Robots-Tag header in public/_headers, and Disallow in public/robots.txt.
  allowIndexing: false,
} as const;
