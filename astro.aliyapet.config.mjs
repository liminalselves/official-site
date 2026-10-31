import { writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The Aliya Pet release service (server/) runs locally during development.
const RELEASE_ORIGIN = 'http://127.0.0.1:8787';

export default defineConfig({
  site: 'https://aliyapet.liminalselves.top',
  srcDir: './sites/aliyapet',
  outDir: './dist-aliyapet',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 1.0,
      lastmod: new Date(),
    }),
    {
      // public/ is shared with the main site; robots.txt must advertise this
      // site's own sitemap, so it is rewritten after the copy step.
      name: 'aliyapet-robots',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          await writeFile(
            new URL('robots.txt', dir),
            'User-agent: *\nAllow: /\n\nSitemap: https://aliyapet.liminalselves.top/sitemap-index.xml\n',
          );
        },
      },
    },
  ],
  // Astro's own `server` option has no proxy; it must go through Vite. X-Forwarded-Host keeps
  // the links the service returns on the dev server's host, like Nginx does in production.
  vite: {
    server: {
      proxy: Object.fromEntries(['/api', '/download', '/files'].map((path) => [path, {
        target: RELEASE_ORIGIN,
        configure: (proxy) => proxy.on('proxyReq', (req, incoming) => req.setHeader('X-Forwarded-Host', incoming.headers.host ?? '')),
      }])),
    },
  },
});
