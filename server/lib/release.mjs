// Pure helpers: version comparison, asset classification and release-note parsing.

/** Parse "v1.2.3" / "1.2.3" into [1, 2, 3]; returns null when it is not a plain x.y.z version. */
export function parseVersion(text) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim());
  return m ? m.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`invalid version: ${!pa ? a : b}`);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

// Platform keys exposed by the API, matched against GitHub release asset names.
export const PLATFORMS = {
  windows: /-setup\.exe$/i,
  'windows-msi': /\.msi$/i,
  android: /\.apk$/i,
};

/** Map uploaded release assets to platform entries; `.sig` files attach to the installer they sign. */
export function classifyAssets(assets) {
  const uploaded = assets.filter((a) => a.state === 'uploaded');
  const result = {};
  for (const [platform, pattern] of Object.entries(PLATFORMS)) {
    const asset = uploaded.find((a) => pattern.test(a.name));
    if (!asset) continue;
    const sig = uploaded.find((a) => a.name === `${asset.name}.sig`);
    result[platform] = {
      name: asset.name,
      size: asset.size,
      digest: /^sha256:([0-9a-f]{64})$/i.exec(asset.digest ?? '')?.[1]?.toLowerCase() ?? null,
      url: asset.browser_download_url,
      sigUrl: sig?.browser_download_url ?? null,
    };
  }
  return result;
}

const MIN_VERSION = /<!--\s*min-version:\s*(v?\d+\.\d+\.\d+)\s*-->/i;

/** Split a release body into user-facing notes and the optional minimum supported version. */
export function parseNotes(body) {
  const text = String(body ?? '').replace(/\r\n/g, '\n');
  const minVersion = MIN_VERSION.exec(text)?.[1]?.replace(/^v/, '') ?? null;
  const notes = text.replace(/<!--[\s\S]*?-->\n?/g, '').trim();
  return { notes, minVersion };
}
