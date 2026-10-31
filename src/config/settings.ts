// App-wide settings. Components import from this file instead of using magic values.
export const settings = {
  ratingMax: 5,
  defaultCenter: { lat: 29.7604, lng: -95.3698 }, // Houston
  defaultZoom: 11,
  distanceUnit: 'mi',
  defaultTags: ['Dumplings', 'Fully veg menu'],
  newSpotTags: ['Dumplings'],
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  photoMaxEdge: 1600,
  photoQuality: 0.82,
  photoMaxBytes: 5_000_000,
  searchMinChars: 3,
  // Indexing is blocked in three places: the <meta name="robots"> tag in index.html,
  // the X-Robots-Tag header in public/_headers, and Disallow in public/robots.txt.
  allowIndexing: false,
} as const;
