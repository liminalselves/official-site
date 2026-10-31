// Runtime fill from /api/latest for the home hero and the download page.
// The static build stays valid on its own: buttons point at /download/* which
// always redirect to the newest file, and version/date text carries a
// build-time fallback from data/changelog-fallback.ts.

import { fetchLatest, fmtDateCN, fmtSize } from './api';
import type { AssetKey } from '../data/pet';

const ASSET_KEYS: AssetKey[] = ['windows', 'windows-msi', 'android'];

function detectOs(): AssetKey | null {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

// Emphasise the hero button matching the visitor OS; with no match both stand
// equal. Only runs where a [data-actions] hero button group exists.
function arrangeButtons(): void {
  const wrap = document.querySelector<HTMLElement>('[data-actions]');
  const win = wrap?.querySelector<HTMLAnchorElement>('[data-download="windows"]');
  const android = wrap?.querySelector<HTMLAnchorElement>('[data-download="android"]');
  if (!wrap || !win || !android || !win.parentElement) return;
  const os = detectOs();
  const primary = os === 'android' ? android : win;
  const secondary = os === 'android' ? win : android;
  primary.classList.add('btn--solid');
  primary.classList.remove('btn--ghost');
  secondary.classList.toggle('btn--ghost', os !== null);
  secondary.classList.toggle('btn--solid', os === null);
  if (primary === android) win.parentElement.insertBefore(android, win);
}

const setText = (sel: string, text: string) => {
  const el = document.querySelector<HTMLElement>(sel);
  if (el && text) el.textContent = text;
};

async function init(): Promise<void> {
  arrangeButtons();

  const data = await fetchLatest();
  if (!data) return;

  if (data.version) setText('[data-meta-version]', data.version);
  if (data.publishedAt) setText('[data-meta-date]', fmtDateCN(data.publishedAt));

  for (const key of ASSET_KEYS) {
    const asset = data.assets?.[key];
    if (data.version) setText(`[data-version="${key}"]`, data.version);
    if (asset?.size) setText(`[data-size="${key}"]`, fmtSize(asset.size));
    if (!asset) continue;

    const a = document.querySelector<HTMLAnchorElement>(`[data-download="${key}"]`);
    if (a) {
      if (asset.url) a.href = asset.url;
      const label = a.querySelector<HTMLElement>('[data-size-label]');
      if (label && asset.size) label.textContent = `${a.dataset.label} · ${fmtSize(asset.size)}`;
    }

    const row = document.querySelector<HTMLElement>(`[data-checksum="${key}"]`);
    if (row) {
      const sha = row.querySelector<HTMLElement>('[data-sha]');
      const copy = row.querySelector<HTMLButtonElement>('[data-copy]');
      if (sha && asset.sha256) sha.textContent = asset.sha256;
      if (copy && asset.sha256) {
        copy.dataset.copy = asset.sha256;
        copy.hidden = false;
      }
    }
  }
}

if (typeof document !== 'undefined') void init();
