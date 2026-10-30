// End-to-end test against a fake GitHub API: run with `npm run test:server`.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
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

async function startService() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  service = spawn(process.execPath, [fileURLToPath(new URL('../index.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, GITHUB_API: ghBase, SYNC_INTERVAL_MINUTES: '60' },
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

const getJson = async (p, init) => {
  const res = await fetch(`${base}${p}`, init);
  return { status: res.status, headers: res.headers, body: res.status === 204 ? null : await res.json() };
};

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'aliyapet-test-'));
  github = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/repos/liminalselves/Aliya_pet/releases/latest') {
      apiCalls++;
      const etag = `"${release.json(ghBase).tag_name}-${release.json(ghBase).body.length}"`;
      if (req.headers['if-none-match'] === etag) return res.writeHead(304).end();
      res.writeHead(200, { 'Content-Type': 'application/json', ETag: etag });
      return res.end(JSON.stringify(release.json(ghBase)));
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
  const { status, body } = await getJson('/api/latest', { headers: { 'X-Forwarded-Host': 'aliyapet.example.com', 'X-Forwarded-Proto': 'https' } });
  assert.equal(status, 200);
  assert.equal(body.version, '0.2.0');
  assert.equal(body.minVersion, '0.1.5');
  assert.equal(body.notes, '## 0.2.0\n- 新功能');
  assert.equal(body.assets.android.url, 'https://aliyapet.example.com/files/0.2.0/AliyaPet_v0.2.0.apk');
  assert.equal(body.assets.windows.sha256, sha(release.files['Aliya.Pet_0.2.0_x64-setup.exe']));
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
  const file = await fetch(body.url);
  assert.equal(Buffer.from(await file.arrayBuffer()).toString(), 'exe 0.2.0');
  assert.equal((await getJson('/api/tauri/windows/x86_64/0.2.0')).status, 204);
  assert.equal((await getJson('/api/tauri/darwin/aarch64/0.1.0')).status, 204);
});

test('/download redirects and /files rejects traversal', async () => {
  const res = await fetch(`${base}/download/windows-msi`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /Aliya\.Pet_0\.2\.0_x64_zh-CN\.msi$/);
  assert.equal((await fetch(`${base}/download/linux`)).status, 404);
  assert.equal((await fetch(`${base}/files/0.2.0/..%2Fcurrent.json`)).status, 404);
  assert.equal((await fetch(`${base}/files/..%2F..%2Fx/current.json`)).status, 404);
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
  const kept = (await readdir(path.join(dataDir, 'releases'))).filter((n) => !n.startsWith('.')).sort();
  assert.deepEqual(kept, ['0.3.0', '0.4.0']);
  const latest = await getJson('/api/latest');
  assert.equal(latest.body.minVersion, null);
});
