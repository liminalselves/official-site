// Aliya Pet release service: mirrors GitHub releases and answers version checks.
// Configuration is read from environment variables; see README "Aliya Pet 发布服务".
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { compareVersions, parseVersion } from './lib/release.mjs';
import { ReleaseSync, safeName } from './lib/sync.mjs';

const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 8787),
  dataDir: path.resolve(process.env.DATA_DIR ?? './data'),
  repo: process.env.GITHUB_REPO ?? 'liminalselves/Aliya_pet',
  apiBase: process.env.GITHUB_API ?? 'https://api.github.com',
  token: process.env.GITHUB_TOKEN || undefined,
  intervalMs: Number(process.env.SYNC_INTERVAL_MINUTES ?? 10) * 60_000,
  keepVersions: Number(process.env.KEEP_VERSIONS ?? 2),
};

const sync = new ReleaseSync({ ...config, log: { info: console.log, error: console.error } });

// Tauri reports {{target}}-{{arch}}; only the Windows NSIS installer is signed for in-place updates.
const TAURI_TARGETS = { 'windows-x86_64': 'windows' };
const CHECK_PLATFORMS = ['windows', 'android'];

/** Absolute links follow the domain the client used, so every mirror domain works unchanged. */
function origin(req) {
  const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || 'http';
  const host = req.headers['x-forwarded-host']?.split(',')[0].trim() || req.headers.host;
  return `${proto}://${host}`;
}

function fileUrl(req, version, asset) {
  return `${origin(req)}/files/${version}/${encodeURIComponent(asset.name)}`;
}

function send(res, status, body, headers = {}) {
  const json = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    ...(json ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    ...headers,
  });
  res.end(json);
}

function latest(req, current) {
  const assets = {};
  for (const [platform, a] of Object.entries(current.assets)) {
    assets[platform] = { name: a.name, size: a.size, sha256: a.sha256, url: fileUrl(req, current.version, a) };
  }
  const { version, name, publishedAt, notes, minVersion, releaseUrl } = current;
  return { version, name, publishedAt, notes, minVersion, releaseUrl, assets };
}

function check(req, current, query) {
  const platform = query.get('platform');
  const version = query.get('version')?.replace(/^v/, '');
  if (!CHECK_PLATFORMS.includes(platform) || !parseVersion(version)) return [400, { error: 'platform and version are required' }];
  const asset = current.assets[platform];
  const base = { current: version, latest: current.version };
  if (!asset || compareVersions(version, current.version) >= 0) return [200, { updateAvailable: false, mandatory: false, ...base }];
  return [200, {
    updateAvailable: true,
    mandatory: Boolean(current.minVersion && compareVersions(version, current.minVersion) < 0),
    ...base,
    publishedAt: current.publishedAt,
    notes: current.notes,
    downloadUrl: fileUrl(req, current.version, asset),
    size: asset.size,
    releasePage: `${origin(req)}/`,
  }];
}

function tauri(req, current, target, arch, version) {
  const asset = current.assets[TAURI_TARGETS[`${target}-${arch}`]];
  if (!asset?.signature || !parseVersion(version) || compareVersions(version, current.version) >= 0) return [204];
  return [200, {
    version: current.version,
    pub_date: current.publishedAt,
    url: fileUrl(req, current.version, asset),
    signature: asset.signature,
    notes: current.notes,
  }];
}

// Production serves /files from Nginx; this keeps local runs and tests self-contained.
async function serveFile(req, res, version, name) {
  let file;
  try {
    if (!parseVersion(version)) throw new Error('bad version');
    file = path.join(sync.releasesDir, version, safeName(name));
    const info = await stat(file);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': info.size,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  } catch {
    return send(res, 404, { error: 'not found' });
  }
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (req.method === 'OPTIONS') return send(res, 204, undefined, { 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Max-Age': '86400' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });

  if (parts[0] === 'healthz') return send(res, 200, { ok: true, version: sync.current?.version ?? null });
  if (parts[0] === 'files' && parts.length === 3) return serveFile(req, res, parts[1], parts[2]);

  const current = sync.current;
  if (parts[0] === 'api' || parts[0] === 'download') {
    if (!current) return send(res, 503, { error: 'no release synced yet' }, { 'Retry-After': '60' });
  }
  if (parts[0] === 'api' && parts[1] === 'latest' && parts.length === 2) return send(res, 200, latest(req, current));
  if (parts[0] === 'api' && parts[1] === 'check' && parts.length === 2) return send(res, ...check(req, current, url.searchParams));
  if (parts[0] === 'api' && parts[1] === 'tauri' && parts.length === 5) return send(res, ...tauri(req, current, parts[2], parts[3], parts[4]));
  if (parts[0] === 'download' && parts.length === 2) {
    const asset = current.assets[parts[1]];
    if (!asset) return send(res, 404, { error: 'unknown platform' });
    return send(res, 302, undefined, { Location: fileUrl(req, current.version, asset) });
  }
  send(res, 404, { error: 'not found' });
}

await sync.load();
const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'internal error' });
    else res.destroy();
  });
});
server.listen(config.port, config.host, () => console.log(`[http] listening on ${config.host}:${config.port}`));

void sync.sync();
setInterval(() => void sync.sync(), config.intervalMs).unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
