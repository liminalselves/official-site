// Cross-site links between the sibling subsites (www / aliyapet).
// Anchors carry a build-time default href on liminalselves.top plus
// data-sibling="<label>"; at runtime the first host label is swapped so the
// same bundle works on every domain the project group owns, while
// localhost / IP / unrelated subdomains keep the default href.

export const SIBLING_LABELS = ['www', 'aliyapet'] as const;
export type SiblingLabel = (typeof SIBLING_LABELS)[number];

const isSibling = (label: string): label is SiblingLabel =>
  (SIBLING_LABELS as readonly string[]).includes(label);

/**
 * Resolve the href for a sibling link seen from `hostname`.
 * `defaultHref` is the absolute build-time URL on the primary domain;
 * its path, query and hash are reused, only the host is rewritten.
 */
export function siblingHref(
  defaultHref: string,
  label: string,
  hostname: string,
  protocol = 'https:',
): string {
  if (!isSibling(label)) return defaultHref;
  let url: URL;
  try {
    url = new URL(defaultHref);
  } catch {
    return defaultHref;
  }
  const host = hostname.toLowerCase();
  const parts = host.split('.');
  if (parts.length < 2) return defaultHref; // localhost / intranet names
  const bare = parts.length === 2; // e.g. liminalselves.top
  if (!bare && !isSibling(parts[0])) return defaultHref; // 127.0.0.1, docs., misskey., …
  const baseDomain = bare ? host : parts.slice(1).join('.');
  return `${protocol}//${label}.${baseDomain}${url.pathname}${url.search}${url.hash}`;
}

/** Rewrite every a[data-sibling] in the document for the current location. */
export function applySiblingLinks(doc: Document = document): void {
  doc.querySelectorAll<HTMLAnchorElement>('a[data-sibling]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    const next = siblingHref(href, a.dataset.sibling ?? '', location.hostname, location.protocol);
    if (next !== href) a.setAttribute('href', next);
  });
}
