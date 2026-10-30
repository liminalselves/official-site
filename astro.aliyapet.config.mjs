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
  server: {
    proxy: {
      '/api': RELEASE_ORIGIN,
      '/download': RELEASE_ORIGIN,
      '/files': RELEASE_ORIGIN,
    },
  },
});
