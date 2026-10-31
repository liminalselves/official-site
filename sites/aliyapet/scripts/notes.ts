// Safe rendering of release-notes markdown. Supported: ##/###/#### headings,
// dash lists, paragraphs, **bold**, `code` (as plain inline text) and http(s)
// links. Everything is HTML-escaped first; GitHub-generated noise lines are
// stripped defensively before parsing.

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

const NOISE_LINE = /^\*\*Full Changelog\*\*|^## What's Changed|^## New Contributors/i;
const NOISE_ITEM = /^[-*]\s+.* by @\S+ in https?:\/\/\S+$/;

// Inline rules applied to already-escaped text; links restricted to http(s).
function renderInline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/** Render a run of trimmed lines (no headings) as paragraphs and lists. */
function renderBlocks(lines: string[]): string {
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
  for (const line of lines) {
    if (!line) {
      flushPara();
      flushList();
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

function cleanLines(md: string): string[] {
  const lines: string[] = [];
  for (const raw of escapeHtml(md).split(/\r?\n/)) {
    const line = raw.trim();
    if (NOISE_LINE.test(line) || NOISE_ITEM.test(line)) continue;
    lines.push(line);
  }
  return lines;
}

export interface NotesSection {
  title: string;
  html: string;
}

export interface ParsedNotes {
  /** Safe HTML of everything before the first heading. */
  summary: string;
  sections: NotesSection[];
}

/** Split notes into a leading summary and heading-titled sections. */
export function parseNotes(md: string): ParsedNotes {
  const summary: string[] = [];
  const sections: NotesSection[] = [];
  let title = '';
  let body: string[] | null = null;
  for (const line of cleanLines(md)) {
    const heading = line.match(/^#{2,4}\s+(.*)$/);
    if (heading) {
      if (body) sections.push({ title, html: renderBlocks(body) });
      title = heading[1].trim();
      body = [];
    } else if (body) {
      body.push(line);
    } else {
      summary.push(line);
    }
  }
  if (body) sections.push({ title, html: renderBlocks(body) });
  return { summary: renderBlocks(summary), sections };
}
