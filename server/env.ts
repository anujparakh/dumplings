export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  EDITOR_EMAILS: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  DEV_AUTH_EMAIL?: string;
  SEARCH_PROVIDER: 'photon' | 'google';
  GOOGLE_PLACES_KEY?: string;
}
