// Download page runtime: feature the card for the visitor's device, then fill version, size,
// file URL and download counts from /api/latest. Without JS or the API the page still
// works: buttons point at /download/* (redirects to the newest file) and the grid stays neutral.

import { fetchLatest, fmtDateCN, fmtSize } from './api';
import type { AssetKey } from '../data/pet';

type Device = { key: AssetKey } | { unsupported: string } | null;

/** The visitor's system: a package key, the name of a system without a build, or null when unknown. */
function detectDevice(): Device {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  if (/iPhone|iPod/.test(ua)) return { unsupported: 'iOS' };
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return { unsupported: 'iPadOS' };
  if (/Android/i.test(ua)) return { key: 'android' };
  if (/HarmonyOS|OpenHarmony/i.test(ua)) return { unsupported: 'HarmonyOS' };
  if (/Windows/.test(ua)) return { key: 'windows' };
  if (/Macintosh|Mac OS X/.test(ua)) return { unsupported: 'macOS' };
  if (/CrOS/.test(ua)) return { unsupported: 'ChromeOS' };
  if (/Linux/.test(ua)) return { unsupported: 'Linux' };
  return null;
}

function feature(): void {
  const list = document.querySelector<HTMLElement>('[data-cards]');
  const device = detectDevice();
  if (!list || !device) return;

  if ('key' in device) {
    const card = list.querySelector<HTMLElement>(`[data-card="${device.key}"]`);
    if (!card) return;
    card.classList.add('card--featured');
    card.querySelector<HTMLElement>('.card__rec')?.removeAttribute('hidden');
    list.prepend(card);
    list.dataset.mode = 'pick';
    return;
  }

  const none = list.querySelector<HTMLElement>('[data-unsupported]');
  if (!none) return;
  const name = none.querySelector<HTMLElement>('[data-device-name]');
  if (name) name.textContent = device.unsupported;
  none.hidden = false;
}

async function fill(): Promise<void> {
  const data = await fetchLatest();
  if (!data) return;

  const version = document.querySelector<HTMLElement>('[data-meta-version]');
  const date = document.querySelector<HTMLElement>('[data-meta-date]');
  if (version && data.version) version.textContent = data.version;
  if (date && data.publishedAt) date.textContent = fmtDateCN(data.publishedAt);

  document.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
    const key = card.dataset.card as AssetKey;
    const asset = data.assets?.[key];
    if (asset) {
      const size = card.querySelector<HTMLElement>('[data-size]');
      const link = card.querySelector<HTMLAnchorElement>('[data-download]');
      if (size && asset.size) size.textContent = fmtSize(asset.size);
      if (link && asset.url) link.href = asset.url;
    }

    const count = data.downloads?.[key];
    const wrap = card.querySelector<HTMLElement>('[data-count]');
    const num = card.querySelector<HTMLElement>('[data-count-num]');
    if (wrap && num && count) {
      num.textContent = count.toLocaleString('zh-CN');
      wrap.hidden = false;
    }
  });
}

if (typeof document !== 'undefined') {
  feature();
  void fill();
}
