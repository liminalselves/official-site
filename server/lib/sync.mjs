// Mirrors the latest GitHub release of Aliya Pet into DATA_DIR and keeps `current.json` pointing at it.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { classifyAssets, compareVersions, parseNotes, parseVersion } from './release.mjs';

export class ReleaseSync {
  constructor({ dataDir, repo, apiBase, token, keepVersions, log = console }) {
    this.dataDir = dataDir;
    this.releasesDir = path.join(dataDir, 'releases');
    this.repo = repo;
    this.apiBase = apiBase.replace(/\/$/, '');
    this.token = token;
    this.keepVersions = keepVersions;
    this.log = log;
    this.current = null;
    this.etag = null;
    this.running = null;
  }

  async load() {
    try {
      this.current = JSON.parse(await readFile(path.join(this.dataDir, 'current.json'), 'utf8'));
      this.log.info(`[sync] serving ${this.current.version}`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  /** Run one sync; concurrent callers share the in-flight run. */
  sync() {
    this.running ??= this.#sync().catch((err) => this.log.error(`[sync] ${err.message}`)).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async #sync() {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'aliyapet-release-service' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    // A matching ETag answers 304, which GitHub does not count against the rate limit.
    if (this.etag) headers['If-None-Match'] = this.etag;
    const res = await fetch(`${this.apiBase}/repos/${this.repo}/releases/latest`, { headers, signal: AbortSignal.timeout(30_000) });
    if (res.status === 304) return;
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const release = await res.json();

    const version = release.tag_name?.replace(/^v/, '');
    if (!parseVersion(version)) throw new Error(`latest release tag is not a version: ${release.tag_name}`);
    const assets = classifyAssets(release.assets ?? []);
    if (!Object.keys(assets).length) throw new Error(`release ${version} has no installer assets yet`);
    // Assets are uploaded after the release is created; wait until the signed Windows installer is there too.
    if (assets.windows && !assets.windows.sigUrl && release.assets.some((a) => a.state !== 'uploaded')) {
      throw new Error(`release ${version} is still uploading`);
    }

    const { notes, minVersion } = parseNotes(release.body);
    const meta = {
      version,
      name: release.name || `Aliya Pet ${version}`,
      publishedAt: release.published_at,
      notes,
      minVersion,
      releaseUrl: release.html_url,
    };

    if (this.current && compareVersions(version, this.current.version) < 0) {
      throw new Error(`latest release ${version} is older than served ${this.current.version}`);
    }
    if (this.current?.version === version && sameFiles(this.current.assets, assets)) {
      // Same files: only refresh text fields so edited release notes show up.
      if (JSON.stringify(pick(this.current)) !== JSON.stringify(meta)) await this.#publish({ ...this.current, ...meta });
      this.etag = res.headers.get('etag');
      return;
    }

    this.log.info(`[sync] mirroring ${version}`);
    const files = await this.#mirror(version, assets, headers);
    await this.#publish({ ...meta, assets: files });
    this.etag = res.headers.get('etag');
    await this.#prune();
    this.log.info(`[sync] now serving ${version}`);
  }

  async #mirror(version, assets, apiHeaders) {
    const staging = path.join(this.releasesDir, `.${version}.partial`);
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    const headers = { 'User-Agent': apiHeaders['User-Agent'] };
    const files = {};
    for (const [platform, asset] of Object.entries(assets)) {
      const sha256 = await download(asset.url, path.join(staging, safeName(asset.name)), headers);
      if (asset.digest && asset.digest !== sha256) throw new Error(`${asset.name}: sha256 mismatch`);
      const entry = { name: asset.name, size: asset.size, sha256 };
      if (asset.sigUrl) {
        const res = await fetch(asset.sigUrl, { headers, signal: AbortSignal.timeout(60_000) });
        if (!res.ok) throw new Error(`${asset.name}.sig: HTTP ${res.status}`);
        entry.signature = (await res.text()).trim();
      }
      files[platform] = entry;
    }
    const target = path.join(this.releasesDir, version);
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
    return files;
  }

  async #publish(manifest) {
    const file = path.join(this.dataDir, 'current.json');
    await writeFile(`${file}.tmp`, JSON.stringify(manifest, null, 2));
    await rename(`${file}.tmp`, file);
    this.current = manifest;
  }

  async #prune() {
    const versions = (await readdir(this.releasesDir)).filter((v) => parseVersion(v));
    versions.sort((a, b) => compareVersions(b, a));
    for (const old of versions.slice(this.keepVersions)) {
      await rm(path.join(this.releasesDir, old), { recursive: true, force: true });
    }
  }
}

function pick({ version, name, publishedAt, notes, minVersion, releaseUrl }) {
  return { version, name, publishedAt, notes, minVersion, releaseUrl };
}

function sameFiles(served, assets) {
  const a = Object.entries(served ?? {}).map(([k, v]) => `${k}:${v.name}:${v.size}:${Boolean(v.signature)}`).sort();
  const b = Object.entries(assets).map(([k, v]) => `${k}:${v.name}:${v.size}:${Boolean(v.sigUrl)}`).sort();
  return a.join() === b.join();
}

/** Asset names come from GitHub; keep them to a single plain path segment. */
export function safeName(name) {
  if (!/^[\w.\-()+ ]+$/.test(name) || name.startsWith('.')) throw new Error(`unsafe asset name: ${name}`);
  return name;
}

async function download(url, dest, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(60 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`download ${url}: HTTP ${res.status}`);
  const hash = createHash('sha256');
  const tap = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body), tap, createWriteStream(dest));
  return hash.digest('hex');
}
