import type { Spot } from '../shared/types';
import { settings } from '../src/config/settings';
import { text } from '../src/config/text';

const NOTES_SNIPPET_LENGTH = 150;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const previewTitle = (spot: Spot | null): string =>
  spot ? `${spot.name} · ${text.appTitle}` : text.appTitle;

function previewDescription(spot: Spot | null): string {
  if (!spot) return text.preview.defaultDescription;
  const notes = spot.notes.slice(0, NOTES_SNIPPET_LENGTH);
  const lead = spot.status === 'been'
    ? `${'🥟'.repeat(spot.rating ?? 0)} ${spot.rating ?? 0}/${settings.ratingMax}`
    : text.preview.wantToGo;
  return notes ? `${lead} ${notes}` : lead;
}

export function buildPreviewTags(spot: Spot | null, origin: string): string {
  const tags: [string, string][] = [
    ['og:type', 'website'],
    ['og:site_name', text.appTitle],
    ['og:title', previewTitle(spot)],
    ['og:description', previewDescription(spot)],
  ];
  if (spot) tags.push(['og:url', `${origin}/spot/${spot.id}`]);
  if (spot?.photos[0]) tags.push(['og:image', `${origin}/api/photos/${spot.photos[0].id}`]);
  const metas = tags.map(([k, v]) => `<meta property="${k}" content="${escapeHtml(v)}">`);
  metas.push(`<meta name="twitter:card" content="${spot?.photos[0] ? 'summary_large_image' : 'summary'}">`);
  return metas.join('\n');
}
