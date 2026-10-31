import { getSpot } from '../../server/db/spots';
import type { Env } from '../../server/env';
import { buildPreviewTags, escapeHtml, previewTitle } from '../../server/preview';

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const asset = await env.ASSETS.fetch(new URL('/', request.url));
  if (asset.status !== 200) return asset;

  const spot = await getSpot(env.DB, String(params.id));
  const origin = new URL(request.url).origin;
  return new HTMLRewriter()
    .on('head', { element: (el) => { el.append(buildPreviewTags(spot, origin), { html: true }); } })
    .on('title', { element: (el) => { el.setInnerContent(escapeHtml(previewTitle(spot)), { html: true }); } })
    .transform(asset);
};
