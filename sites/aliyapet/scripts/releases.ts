// Timeline card renderer plus runtime fill from /api/releases: the changelog
// timeline and the home changelog entry. Falls back quietly to the build-time
// list in data/changelog-fallback.ts. Used server-side too, so keep it free of
// top-level DOM access outside init().

import { fetchReleases, fmtDateCN, type Release } from './api';
import { escapeHtml, parseNotes } from './notes';

/** Versions after the first N are collapsed behind the「查看更早的版本」button. */
const COLLAPSE_AFTER = 3;

function sectionKind(title: string): string {
  if (/新增/.test(title)) return 'add';
  if (/改进|优化/.test(title)) return 'imp';
  if (/修复/.test(title)) return 'fix';
  return 'other';
}

/** One <li> card for the timeline; HTML is escaped via parseNotes/escapeHtml. */
export function renderReleaseCard(rel: Release, index: number, latest: boolean): string {
  const { summary, sections } = parseNotes(rel.notes ?? '');
  const badges = [
    latest ? '<span class="rel__badge">最新版本</span>' : '',
    rel.minVersion ? '<span class="rel__badge rel__badge--major">重要更新</span>' : '',
  ].filter(Boolean).join('');
  const minNote = rel.minVersion
    ? `<p class="rel__min">低于 v${escapeHtml(rel.minVersion)} 的版本需要更新后才能继续使用</p>`
    : '';
  const secs = sections
    .filter((s) => s.title && s.html)
    .map(
      (s) =>
        `<section class="rel__sec rel__sec--${sectionKind(s.title)}"><h4>${s.title}</h4>${s.html}</section>`,
    )
    .join('\n');
  const date = fmtDateCN(rel.publishedAt);
  const old = index >= COLLAPSE_AFTER;
  return `<li class="rel${old ? ' rel--old' : ''}"${old ? ' hidden' : ''}>
  <span class="rel__node" aria-hidden="true"></span>
  <article class="rel__card">
    <header class="rel__head">
      <h3 class="rel__version serif">v${escapeHtml(rel.version)}</h3>
      ${date ? `<p class="rel__date">${date}</p>` : ''}
      ${badges ? `<p class="rel__badges">${badges}</p>` : ''}
      ${minNote}
    </header>
    ${summary ? `<div class="rel__summary">${summary}</div>` : ''}
    ${secs}
  </article>
</li>`;
}

const setText = (sel: string, text: string) => {
  const el = document.querySelector<HTMLElement>(sel);
  if (el && text) el.textContent = text;
};

async function init(): Promise<void> {
  const list = document.querySelector<HTMLOListElement>('[data-releases-list]');
  const more = document.querySelector<HTMLButtonElement>('[data-releases-more]');
  const syncMore = () => {
    if (list && more) more.hidden = !list.querySelector('.rel--old');
  };
  if (list && more) {
    more.addEventListener('click', () => {
      list.querySelectorAll('.rel--old').forEach((el) => el.removeAttribute('hidden'));
      more.hidden = true;
    });
  }
  syncMore();

  const releases = await fetchReleases();
  const top = releases?.find((r) => r.latest) ?? releases?.[0];
  if (top) {
    setText('[data-log-version]', `v${top.version}`);
    setText('[data-log-date]', fmtDateCN(top.publishedAt));
    const link = document.querySelector<HTMLAnchorElement>('[data-release]');
    if (link && top.releaseUrl) link.href = top.releaseUrl;
  }
  if (!list || !releases) return;

  const hasFlag = releases.some((r) => r.latest);
  list.innerHTML = releases
    .map((r, i) => renderReleaseCard(r, i, hasFlag ? !!r.latest : i === 0))
    .join('\n');
  syncMore();
}

if (typeof document !== 'undefined') void init();
