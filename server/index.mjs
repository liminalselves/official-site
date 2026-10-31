// One Node service for both sites: pages, APIs and downloads. The request host picks the site
// (aliyapet.<domain> -> Aliya Pet, anything else -> main site), so every domain the group owns
// works without extra config. Locally: http://localhost:8787 and http://aliyapet.localhost:8787.
// See README "服务".
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestHost, sendJson, siteFor } from './lib/http.mjs';
import { ReleaseSync } from './lib/sync.mjs';
import { createAliyaPetSite } from './sites/aliyapet.mjs';
import { createMainSite } from './sites/main.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 8787),
  // Built pages: dist/ and dist-aliyapet/ in the repo by default; the deploy branch sets these.
  mainDist: path.resolve(repoRoot, process.env.MAIN_DIST ?? 'dist'),
  aliyapetDist: path.resolve(repoRoot, process.env.ALIYAPET_DIST ?? 'dist-aliyapet'),
  dataDir: path.resolve(process.env.DATA_DIR ?? path.join(repoRoot, 'data')),
  repo: process.env.GITHUB_REPO ?? 'liminalselves/Aliya_pet',
  apiBase: process.env.GITHUB_API ?? 'https://api.github.com',
  token: process.env.GITHUB_TOKEN || undefined,
  intervalMs: Number(process.env.SYNC_INTERVAL_MINUTES ?? 10) * 60_000,
  keepVersions: Number(process.env.KEEP_VERSIONS ?? 2),
};

const sync = new ReleaseSync({ ...config, log: { info: console.log, error: console.error } });
const sites = {
  main: createMainSite({ dist: config.mainDist }),
  aliyapet: createAliyaPetSite({ sync, dist: config.aliyapetDist }),
};

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true, version: sync.current?.version ?? null });
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    return sendJson(res, 405, { error: 'method not allowed' });
  }
  return sites[siteFor(requestHost(req))](req, res, url);
}

await sync.load();
const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
    else res.destroy();
  });
});
server.listen(config.port, config.host, () => {
  console.log(`[http] main site      http://localhost:${config.port}`);
  console.log(`[http] Aliya Pet site http://aliyapet.localhost:${config.port}`);
});

void sync.sync();
setInterval(() => void sync.sync(), config.intervalMs).unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
