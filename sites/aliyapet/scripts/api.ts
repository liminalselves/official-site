// Shared client for the same-origin release API (/api/latest, /api/releases).
// Requests are cached per endpoint so a page never fetches the same one
// twice; failures resolve to null so callers can keep their static fallback.

import type { Release } from '../data/changelog-fallback';

export type { Release };

export interface ReleaseAsset {
  name: string;
  size: number;
  sha256: string;
  url: string;
}

export interface LatestRelease extends Omit<Release, 'latest'> {
  assets: Partial<Record<string, ReleaseAsset>>;
}

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T | null> {
  let pending = cache.get(url) as Promise<T | null> | undefined;
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return (await res.json()) as T;
      } catch {
        return null;
      }
    })();
    cache.set(url, pending);
  }
  return pending;
}

export const fetchLatest = () => getJson<LatestRelease>('/api/latest');

const toTime = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** All releases, newest first (defensively re-sorted by publish date). */
export async function fetchReleases(): Promise<Release[] | null> {
  const data = await getJson<{ releases?: Release[] }>('/api/releases');
  const list = data?.releases;
  if (!list?.length) return null;
  return [...list].sort((a, b) => toTime(b.publishedAt) - toTime(a.publishedAt));
}

/** 「2026 年 10 月 25 日」 from the ISO date part (timezone-independent). */
export function fmtDateCN(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日` : '';
}

export const fmtSize = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
