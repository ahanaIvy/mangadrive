// MangaDrive Cloudflare Worker
// 静的ファイル（dist/）は Workers Static Assets が配信。Worker は /pdf のみ担当：
// CORS 非対応の PDF をリーダーで読めるようにするプロキシ（掲載作品の PDF のみ許可＝オープンプロキシにしない）
let allow = null;
let allowAt = 0;

async function allowedPdfs(env, origin) {
  if (allow && Date.now() - allowAt < 5 * 60 * 1000) return allow;
  const res = await env.ASSETS.fetch(new Request(`${origin}/api/manga.json`));
  const data = res.ok ? await res.json() : { items: [] };
  allow = new Set(data.items.map((i) => i.pdf));
  allowAt = Date.now();
  return allow;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/pdf') return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });

    const target = url.searchParams.get('u') || '';
    if (!(await allowedPdfs(env, url.origin)).has(target)) return new Response('Not Found', { status: 404 });

    const headers = { 'user-agent': 'Mozilla/5.0 (compatible; MangaDriveBot/1.0; +https://mangadrive.online/about/)' };
    const range = request.headers.get('range');
    if (range) headers.range = range;
    const upstream = await fetch(target, { method: request.method, headers, cf: { cacheEverything: true, cacheTtl: 86400 } });

    const out = new Headers();
    for (const h of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }
    out.set('content-type', 'application/pdf');
    out.set('cache-control', 'public, max-age=86400');
    out.set('access-control-allow-origin', url.origin);
    out.set('access-control-expose-headers', 'content-length, content-range, accept-ranges');
    out.set('x-robots-tag', 'noindex');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
