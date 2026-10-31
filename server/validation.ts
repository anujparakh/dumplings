import { z } from 'zod';
import { settings } from '../src/config/settings';

const TAG_MAX = 30;

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, ' ');
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export const spotInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    address: z.string().max(300).nullable(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    status: z.enum(['been', 'want']),
    rating: z.number().int().min(1).max(settings.ratingMax).nullable(),
    visitedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    notes: z.string().max(5000).default(''),
    tags: z
      .array(z.string())
      .transform(normalizeTags)
      .refine((tags) => tags.every((t) => t.length <= TAG_MAX), { message: `tags max ${TAG_MAX} chars` }),
  })
  .superRefine((spot, ctx) => {
    if (spot.status !== 'want') return;
    if (spot.rating !== null) {
      ctx.addIssue({ code: 'custom', path: ['rating'], message: 'rating must be null for want spots' });
    }
    if (spot.visitedOn !== null) {
      ctx.addIssue({ code: 'custom', path: ['visitedOn'], message: 'visitedOn must be null for want spots' });
    }
  });
