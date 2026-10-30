// Runtime fill for the download page from the same-origin release API (/api/latest).
// The static build stays valid on its own: buttons point at /download/* which
// always redirect to the newest file; if the fetch fails the fallback is kept.

import type { AssetKey } from '../data/pet';

interface Asset {
  name: string;
  size: number;
  sha256: string;
  url: string;
}

interface Latest {
  version: string;
  name: string;
  publishedAt: string;
  notes: string;
  minVersion: string | null;
  releaseUrl: string | null;
  assets: Partial<Record<AssetKey, Asset>>;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

// Inline rules applied to already-escaped text; links restricted to http(s).
function renderInline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/** Render release notes markdown to safe HTML (headings ##/###, lists, paragraphs). */
export function renderNotes(md: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${renderInline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${renderInline(li)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const raw of escapeHtml(md).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      out.push(`<h3>${renderInline(heading[2])}</h3>`);
      continue;
    }
    const item = line.match(/^[-*]\s+(.*)$/);
    if (item) {
      flushPara();
      list.push(item[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join('\n');
}

function detectOs(): AssetKey | null {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

// Emphasise the button matching the visitor OS; with no match both stand equal.
function arrangeButtons(os: AssetKey | null): void {
  const win = document.querySelector<HTMLAnchorElement>('[data-download="windows"]');
  const android = document.querySelector<HTMLAnchorElement>('[data-download="android"]');
  if (!win || !android || !win.parentElement) return;
  const primary = os === 'android' ? android : win;
  const secondary = os === 'android' ? win : android;
  primary.classList.add('btn--solid');
  primary.classList.remove('btn--ghost');
  secondary.classList.toggle('btn--ghost', os !== null);
  secondary.classList.toggle('btn--solid', os === null);
  if (primary === android) win.parentElement.insertBefore(android, win);
}

const fmtSize = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};
const setText = (sel: string, text: string) => {
  const el = document.querySelector<HTMLElement>(sel);
  if (el) el.textContent = text;
};

async function init(): Promise<void> {
  arrangeButtons(detectOs());

  let data: Latest;
  try {
    const res = await fetch('/api/latest');
    if (!res.ok) return; // no release synced yet; keep the static fallback
    data = (await res.json()) as Latest;
  } catch {
    return;
  }

  if (data.version) setText('[data-meta-version]', data.version);
  if (data.publishedAt) setText('[data-meta-date]', fmtDate(data.publishedAt));
  setText('[data-log-version]', data.version || '—');
  setText('[data-log-date]', data.publishedAt ? fmtDate(data.publishedAt) : '—');

  for (const key of ['windows', 'android', 'windows-msi'] as AssetKey[]) {
    const asset = data.assets?.[key];
    const a = document.querySelector<HTMLAnchorElement>(`[data-download="${key}"]`);
    if (!a || !asset) continue;
    if (asset.url) a.href = asset.url;
    const label = a.querySelector<HTMLElement>('[data-size-label]');
    if (label && asset.size) label.textContent = `${a.dataset.label} · ${fmtSize(asset.size)}`;

    const row = document.querySelector<HTMLElement>(`[data-checksum="${key}"]`);
    if (row) {
      const file = row.querySelector<HTMLElement>('[data-file]');
      const sha = row.querySelector<HTMLElement>('[data-sha]');
      const copy = row.querySelector<HTMLButtonElement>('[data-copy]');
      if (file && asset.name) file.textContent = asset.name;
      if (sha && asset.sha256) sha.textContent = asset.sha256;
      if (copy && asset.sha256) {
        copy.dataset.copy = asset.sha256;
        copy.hidden = false;
      }
    }
  }

  const notes = document.querySelector<HTMLElement>('[data-notes]');
  if (notes && data.notes?.trim()) notes.innerHTML = renderNotes(data.notes);
  const release = document.querySelector<HTMLAnchorElement>('[data-release]');
  if (release && data.releaseUrl) release.href = data.releaseUrl;
}

if (typeof document !== 'undefined') {
  void init();
}
