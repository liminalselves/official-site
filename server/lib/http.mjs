// Small HTTP helpers shared by the sites.

/** Host the client asked for; behind Nginx this is X-Forwarded-Host. */
export function requestHost(req) {
  return (req.headers['x-forwarded-host']?.split(',')[0].trim() || req.headers.host || '').toLowerCase();
}

/** Absolute links follow the domain the client used, so every domain the group owns works unchanged. */
export function origin(req) {
  const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || 'http';
  return `${proto}://${requestHost(req)}`;
}

/** Site key for a host: the first label picks the site (aliyapet.<any domain>), everything else is the main site. */
export function siteFor(host) {
  const label = host.replace(/:\d+$/, '').split('.')[0];
  return label === 'aliyapet' ? 'aliyapet' : 'main';
}

export function sendJson(res, status, body, headers = {}) {
  const json = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    ...(json ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    ...headers,
  });
  res.end(json);
}
