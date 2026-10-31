// End-to-end test of the service against a fake GitHub API and fixture sites: `npm test`.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { classifyAssets, compareVersions, parseNotes } from '../lib/release.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

function makeRelease(version, { body = '', broken = false } = {}) {
  const files = {
    [`Aliya.Pet_${version}_x64-setup.exe`]: Buffer.from(`exe ${version}`),
    [`Aliya.Pet_${version}_x64-setup.exe.sig`]: Buffer.from(`sig-of-${version}\n`),
    [`Aliya.Pet_${version}_x64_zh-CN.msi`]: Buffer.from(`msi ${version}`),
    [`AliyaPet_v${version}.apk`]: Buffer.from(`apk ${version}`),
  };
  return {
    files,
    json: (base) => ({
      tag_name: `v${version}`,
      name: `Aliya Pet ${version}`,
      published_at: '2026-10-30T00:00:00Z',
      html_url: `https://github.com/liminalselves/Aliya_pet/releases/tag/v${version}`,
      body,
      assets: Object.entries(files).map(([name, buf]) => ({
        name,
        size: buf.length,
        state: 'uploaded',
        digest: `sha256:${broken && name.endsWith('.apk') ? '0'.repeat(64) : sha(buf)}`,
        browser_download_url: `${base}/dl/${version}/${encodeURIComponent(name)}`,
      })),
    }),
  };
}

let github;
let ghBase;
let release;
let apiCalls = 0;
let service;
let base;
let dataDir;
let sitesDir;

// Requests carry a Host header picking the site; Node's fetch cannot set Host, so use X-Forwarded-Host like Nginx.
const PET = { 'X-Forwarded-Host': 'aliyapet.example.com' };
const MAIN = { 'X-Forwarded-Host': 'www.example.com' };

async function startService() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  service = spawn(process.execPath, [fileURLToPath(new URL('../index.mjs', import.meta.url))], {
    env: {
      ...process.env, PORT: String(port), DATA_DIR: dataDir, GITHUB_API: ghBase, SYNC_INTERVAL_MINUTES: '60',
      MAIN_DIST: path.join(sitesDir, 'main'), ALIYAPET_DIST: path.join(sitesDir, 'aliyapet'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  service.stderr.on('data', (d) => process.stderr.write(`[service] ${d}`));
  base = `http://127.0.0.1:${port}`;
  await waitFor(async () => (await fetch(`${base}/healthz`)).ok);
}

async function stopService() {
  service.kill();
  await new Promise((r) => service.once('exit', r));
}

async function waitFor(fn, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    try {
      if (await fn()) return;
    } catch { /* not ready */ }
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 100));
  }
}

const pet = (p, init = {}) => fetch(`${base}${p}`, { ...init, headers: { ...PET, ...init.headers } });
const main = (p, init = {}) => fetch(`${base}${p}`, { ...init, headers: { ...MAIN, ...init.headers } });
const getJson = async (p, init = {}) => {
  const res = await pet(p, init);
  return { status: res.status, headers: res.headers, body: res.status === 204 ? null : await res.json() };
};

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'aliyapet-test-'));
  sitesDir = await mkdtemp(path.join(tmpdir(), 'sites-test-'));
  const page = async (site, rel, body) => {
    const file = path.join(sitesDir, site, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  };
  await page('main', 'index.html', '<h1>main home</h1>');
  await page('main', '404.html', '<h1>main 404</h1>');
  await page('main', '_astro/app.abc.js', 'console.log(1);'.repeat(200));
  await page('aliyapet', 'index.html', '<h1>pet home</h1>');
  await page('aliyapet', '404.html', '<h1>pet 404</h1>');
  await page('aliyapet', 'download/index.html', '<h1>pet download page</h1>');
  await page('aliyapet', '.secret', 'nope');
  github = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/repos/liminalselves/Aliya_pet/releases/latest') {
      apiCalls++;
      const etag = `"${release.json(ghBase).tag_name}-${release.json(ghBase).body.length}"`;
      if (req.headers['if-none-match'] === etag) return res.writeHead(304).end();
      res.writeHead(200, { 'Content-Type': 'application/json', ETag: etag });
      return res.end(JSON.stringify(release.json(ghBase)));
    }
    if (url.pathname === '/repos/liminalselves/Aliya_pet/releases') {
      const old = { tag_name: 'v0.0.9', name: 'Aliya Pet 0.0.9', published_at: '2026-10-01T00:00:00Z', html_url: 'x', body: '旧版说明', draft: false, prerelease: false };
      const pre = { ...old, tag_name: 'v9.0.0-beta', prerelease: true };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([pre, { ...release.json(ghBase), draft: false, prerelease: false }, old]));
    }
    const m = /^\/dl\/[^/]+\/(.+)$/.exec(url.pathname);
    const buf = m && release.files[decodeURIComponent(m[1])];
    if (buf) return res.writeHead(200).end(buf);
    res.writeHead(404).end();
  });
  await new Promise((r) => github.listen(0, '127.0.0.1', r));
  ghBase = `http://127.0.0.1:${github.address().port}`;
  release = makeRelease('0.2.0', { body: '## 0.2.0\n<!-- min-version: 0.1.5 -->\n- 新功能\n' });
  await startService();
  await waitFor(async () => (await getJson('/healthz')).body.version === '0.2.0');
});

after(async () => {
  await stopService();
  github.close();
  await rm(dataDir, { recursive: true, force: true });
  await rm(sitesDir, { recursive: true, force: true });
});

test('pure helpers', () => {
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
  assert.deepEqual(parseNotes('a\n<!-- min-version: v0.3.0 -->\nb'), { notes: 'a\nb', minVersion: '0.3.0' });
  const assets = classifyAssets(makeRelease('1.0.0').json('http://h').assets);
  assert.deepEqual(Object.keys(assets).sort(), ['android', 'windows', 'windows-msi']);
  assert.ok(assets.windows.sigUrl.endsWith('setup.exe.sig'));
  assert.equal(assets.android.sigUrl, null);
});

test('/api/latest describes mirrored files on the requesting host', async () => {
  const { status, body } = await getJson('/api/latest', { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(status, 200);
  assert.equal(body.version, '0.2.0');
  assert.equal(body.minVersion, '0.1.5');
  assert.equal(body.notes, '## 0.2.0\n- 新功能');
  assert.equal(body.assets.android.url, 'https://aliyapet.example.com/files/0.2.0/AliyaPet_v0.2.0.apk');
  assert.equal(body.assets.windows.sha256, sha(release.files['Aliya.Pet_0.2.0_x64-setup.exe']));
});

test('/api/releases lists published versions newest first', async () => {
  const { status, body } = await getJson('/api/releases');
  assert.equal(status, 200);
  assert.deepEqual(body.releases.map((r) => r.version), ['0.2.0', '0.0.9']);
  assert.equal(body.releases[0].latest, true);
  assert.equal(body.releases[0].minVersion, '0.1.5');
  assert.equal(body.releases[1].notes, '旧版说明');
});

test('/api/check covers update, mandatory, up to date and bad input', async () => {
  const mandatory = await getJson('/api/check?platform=android&version=0.1.0');
  assert.equal(mandatory.body.updateAvailable, true);
  assert.equal(mandatory.body.mandatory, true);
  assert.match(mandatory.body.downloadUrl, /\/files\/0\.2\.0\/AliyaPet_v0\.2\.0\.apk$/);
  const optional = await getJson('/api/check?platform=windows&version=0.1.5');
  assert.equal(optional.body.mandatory, false);
  assert.equal(optional.body.updateAvailable, true);
  assert.equal((await getJson('/api/check?platform=windows&version=0.2.0')).body.updateAvailable, false);
  assert.equal((await getJson('/api/check?platform=ios&version=0.1.0')).status, 400);
  assert.equal(mandatory.headers.get('access-control-allow-origin'), '*');
});

test('/api/tauri returns signed update or 204', async () => {
  const { status, body } = await getJson('/api/tauri/windows/x86_64/0.1.0');
  assert.equal(status, 200);
  assert.equal(body.signature, 'sig-of-0.2.0');
  assert.equal(body.version, '0.2.0');
  const file = await pet(new URL(body.url).pathname);
  assert.equal(Buffer.from(await file.arrayBuffer()).toString(), 'exe 0.2.0');
  assert.equal((await getJson('/api/tauri/windows/x86_64/0.2.0')).status, 204);
  assert.equal((await getJson('/api/tauri/darwin/aarch64/0.1.0')).status, 204);
});

test('/download redirects and /files rejects traversal', async () => {
  const res = await pet('/download/windows-msi', { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /Aliya\.Pet_0\.2\.0_x64_zh-CN\.msi$/);
  assert.equal((await pet('/download/linux')).status, 404);
  assert.equal((await pet('/files/0.2.0/..%2Fcurrent.json')).status, 404);
  assert.equal((await pet('/files/..%2F..%2Fx/current.json')).status, 404);
});

test('unchanged release answers 304 and keeps serving after restart', async () => {
  await stopService();
  const before = apiCalls;
  await startService();
  await waitFor(() => apiCalls > before);
  assert.equal((await getJson('/healthz')).body.version, '0.2.0');
});

test('new release replaces the old one; bad digest is rejected; old versions pruned', async () => {
  release = makeRelease('0.3.0', { broken: true });
  await stopService();
  await startService();
  await new Promise((r) => setTimeout(r, 500));
  assert.equal((await getJson('/healthz')).body.version, '0.2.0', 'broken release must not be served');

  for (const v of ['0.3.0', '0.4.0']) {
    release = makeRelease(v);
    await stopService();
    await startService();
    await waitFor(async () => (await getJson('/healthz')).body.version === v);
  }
  // healthz updates on publish; pruning finishes right after, so wait for it to settle.
  let kept;
  await waitFor(async () => {
    kept = (await readdir(path.join(dataDir, 'releases'))).filter((n) => !n.startsWith('.')).sort();
    return kept.length === 2;
  });
  assert.deepEqual(kept, ['0.3.0', '0.4.0']);
  const latest = await getJson('/api/latest');
  assert.equal(latest.body.minVersion, null);
});

test('host picks the site; directories, 404 pages and dotfiles behave like Nginx', async () => {
  assert.equal(await (await main('/')).text(), '<h1>main home</h1>');
  assert.equal(await (await pet('/')).text(), '<h1>pet home</h1>');
  const bare = await fetch(`${base}/`, { headers: { 'X-Forwarded-Host': 'example.com' } });
  assert.equal(await bare.text(), '<h1>main home</h1>', 'bare domain and unknown hosts get the main site');

  const redirect = await pet('/download?x=1', { redirect: 'manual' });
  assert.equal(redirect.status, 301, '/download without slash is the page, not the API');
  assert.equal(redirect.headers.get('location'), '/download/?x=1');
  assert.equal(await (await pet('/download/')).text(), '<h1>pet download page</h1>');

  const missing = await pet('/nope');
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), '<h1>pet 404</h1>');
  assert.equal((await main('/nope')).status, 404);
  assert.equal((await pet('/.secret')).status, 404);
  assert.equal((await pet('/..%2F..%2Fpackage.json')).status, 404);

  const api = await main('/api/latest');
  assert.equal(api.status, 404, 'the main site has no release API');
  assert.match(api.headers.get('content-type'), /json/);
});

test('static files: compression, caching headers, 304 and byte ranges', async () => {
  const js = await main('/_astro/app.abc.js', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(js.headers.get('content-encoding'), 'gzip');
  assert.match(js.headers.get('cache-control'), /immutable/);
  assert.equal((await js.text()).length, 'console.log(1);'.length * 200, 'fetch decodes gzip transparently');

  const html = await pet('/');
  assert.equal(html.headers.get('cache-control'), 'no-cache');
  const again = await pet('/', { headers: { 'If-None-Match': html.headers.get('etag') } });
  assert.equal(again.status, 304);

  const url = (await getJson('/api/latest')).body.assets.windows.url.replace(/^https?:\/\/[^/]+/, '');
  const part = await pet(url, { headers: { Range: 'bytes=4-' } });
  assert.equal(part.status, 206);
  assert.equal(await part.text(), release.files[`Aliya.Pet_${release.json('').tag_name.slice(1)}_x64-setup.exe`].subarray(4).toString());
  assert.match(part.headers.get('content-disposition'), /attachment/);
});
