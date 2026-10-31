// Main site (www.<domain>): pages from dist/. API routes for the main site go under /api/
// here; there are none yet, so /api/* answers 404 JSON instead of the HTML 404 page.
import { sendJson } from '../lib/http.mjs';
import { createStaticSite } from '../lib/static.mjs';

export function createMainSite({ dist }) {
  const pages = createStaticSite(dist);
  return async function handle(req, res, url) {
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
    return pages(req, res, url);
  };
}
