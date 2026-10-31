export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  /** The shared editor password, stored as a secret. Editing is off until it is set. */
  EDITOR_PASSWORD?: string;
  SEARCH_PROVIDER: 'photon' | 'google';
  GOOGLE_PLACES_KEY?: string;
}
