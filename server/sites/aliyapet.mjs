// Aliya Pet site (aliyapet.<domain>): pages from dist-aliyapet/, the release API, download
// redirects and the mirrored installers. Releases come from ReleaseSync (lib/sync.mjs).
import path from 'node:path';
import { origin, sendJson } from '../lib/http.mjs';
import { compareVersions, parseVersion } from '../lib/release.mjs';
import { createStaticSite, sendFile } from '../lib/static.mjs';
import { safeName } from '../lib/sync.mjs';

// Tauri reports {{target}}-{{arch}}; only the Windows NSIS installer is signed for in-place updates.
const TAURI_TARGETS = { 'windows-x86_64': 'windows' };
const CHECK_PLATFORMS = ['windows', 'android'];

export function createAliyaPetSite({ sync, dist }) {
  const pages = createStaticSite(dist);
  const fileUrl = (req, version, asset) => `${origin(req)}/files/${version}/${encodeURIComponent(asset.name)}`;

  function latest(req, current) {
    const assets = {};
    for (const [platform, a] of Object.entries(current.assets)) {
      assets[platform] = { name: a.name, size: a.size, sha256: a.sha256, url: fileUrl(req, current.version, a) };
    }
    const { version, name, publishedAt, notes, minVersion, releaseUrl } = current;
    return { version, name, publishedAt, notes, minVersion, releaseUrl, assets };
  }

  /** Every published version, newest first; the served version also carries the mirrored text. */
  function releases(current) {
    const list = [...sync.history];
    if (current && !list.some((r) => r.version === current.version)) list.unshift(current);
    return {
      releases: list.map(({ version, name, publishedAt, notes, minVersion, releaseUrl }) => ({
        version, name, publishedAt, notes, minVersion, releaseUrl, latest: version === current?.version,
      })),
    };
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

  async function installer(req, res, version, name) {
    let file;
    try {
      if (!parseVersion(version)) throw new Error('bad version');
      file = path.join(sync.releasesDir, version, safeName(name));
      return await sendFile(req, res, file, {
        cache: 'public, max-age=31536000, immutable',
        headers: { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` },
      });
    } catch {
      return sendJson(res, 404, { error: 'not found' });
    }
  }

  return async function handle(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean);
    let seg;
    try {
      seg = parts.map(decodeURIComponent);
    } catch {
      return sendJson(res, 400, { error: 'bad path' });
    }
    // /download/ (the page) and /download/<platform> (redirect to the file) share a prefix.
    const isApi = seg[0] === 'api' || seg[0] === 'files' || (seg[0] === 'download' && seg.length === 2);
    if (!isApi) return pages(req, res, url);

    if (req.method === 'OPTIONS') return sendJson(res, 204, undefined, { 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Max-Age': '86400' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method not allowed' });
    if (seg[0] === 'files' && seg.length === 3) return installer(req, res, seg[1], seg[2]);

    const current = sync.current;
    if (!current) return sendJson(res, 503, { error: 'no release synced yet' }, { 'Retry-After': '60' });
    if (seg[0] === 'api' && seg[1] === 'releases' && seg.length === 2) return sendJson(res, 200, releases(current));
    if (seg[0] === 'api' && seg[1] === 'latest' && seg.length === 2) return sendJson(res, 200, latest(req, current));
    if (seg[0] === 'api' && seg[1] === 'check' && seg.length === 2) return sendJson(res, ...check(req, current, url.searchParams));
    if (seg[0] === 'api' && seg[1] === 'tauri' && seg.length === 5) return sendJson(res, ...tauri(req, current, seg[2], seg[3], seg[4]));
    if (seg[0] === 'download' && seg.length === 2) {
      const asset = current.assets[seg[1]];
      if (!asset) return sendJson(res, 404, { error: 'unknown platform' });
      return sendJson(res, 302, undefined, { Location: fileUrl(req, current.version, asset) });
    }
    return sendJson(res, 404, { error: 'not found' });
  };
}
