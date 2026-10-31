// Static file serving for the built sites (dist/, dist-aliyapet/) and mirrored installers.
// Handles directory index and trailing-slash redirects, the site's 404 page, ETag/304,
// gzip/brotli for text files and single byte ranges for downloads.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.frag': 'text/plain; charset=utf-8',
  '.vert': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.moc3': 'application/octet-stream',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.msi': 'application/x-msi',
  '.apk': 'application/vnd.android.package-archive',
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml)|image\/svg)/;
// Hashed build output never changes under the same name.
const IMMUTABLE = /^\/(_astro|pet\/assets)\//;

const encoders = {
  br: promisify((buf, cb) => brotliCompress(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }, cb)),
  gzip: promisify(gzip),
};
const compressed = new Map();

function pickEncoding(req) {
  const accept = req.headers['accept-encoding'] ?? '';
  if (/\bbr\b/.test(accept)) return 'br';
  if (/\bgzip\b/.test(accept)) return 'gzip';
  return null;
}

/**
 * Send one file. `headers` are added as-is (e.g. Content-Disposition); `cache` overrides
 * the Cache-Control value.
 */
export async function sendFile(req, res, file, { status = 200, headers = {}, cache = 'no-cache' } = {}) {
  const info = await stat(file);
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const etag = `W/"${info.size.toString(36)}-${info.mtimeMs.toString(36)}"`;
  const base = {
    'Content-Type': type,
    'Cache-Control': cache,
    ETag: etag,
    'Last-Modified': info.mtime.toUTCString(),
    ...headers,
  };
  if (status === 200 && req.headers['if-none-match'] === etag) {
    res.writeHead(304, base);
    return res.end();
  }

  const encoding = COMPRESSIBLE.test(type) && info.size > 1024 ? pickEncoding(req) : null;
  if (encoding) {
    const key = `${file}|${info.mtimeMs}|${encoding}`;
    let body = compressed.get(key);
    if (!body) {
      body = await encoders[encoding](await readFile(file));
      compressed.set(key, body);
    }
    res.writeHead(status, { ...base, 'Content-Encoding': encoding, 'Content-Length': body.length, Vary: 'Accept-Encoding' });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }

  // Single byte range, so interrupted installer downloads can resume.
  const range = status === 200 ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '') : null;
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : info.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : info.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, info.size - 1);
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      return res.end();
    }
    res.writeHead(206, { ...base, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }

  res.writeHead(status, { ...base, 'Accept-Ranges': 'bytes', 'Content-Length': info.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

/** Static handler for one built site directory. */
export function createStaticSite(dist) {
  const root = path.resolve(dist);
  const notFound = async (req, res) => {
    try {
      await sendFile(req, res, path.join(root, '404.html'), { status: 404 });
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  };

  return async function serve(req, res, url) {
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return notFound(req, res);
    }
    // No dotfiles, no traversal outside the site directory.
    if (pathname.split('/').some((seg) => seg.startsWith('.'))) return notFound(req, res);
    const file = path.join(root, pathname);
    if (file !== root && !file.startsWith(root + path.sep)) return notFound(req, res);

    let info;
    try {
      info = await stat(file);
    } catch {
      return notFound(req, res);
    }
    if (info.isDirectory()) {
      // Same behaviour as Nginx try_files $uri $uri/: /features -> /features/
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        return res.end();
      }
      try {
        return await sendFile(req, res, path.join(file, 'index.html'));
      } catch {
        return notFound(req, res);
      }
    }
    const cache = IMMUTABLE.test(pathname) ? 'public, max-age=31536000, immutable' : 'no-cache';
    return sendFile(req, res, file, { cache });
  };
}
