// 自動クローラー：data/crawl.json に登録したサイトを巡回し、PDF リンクと
// そのページのタイトル・説明・アイキャッチ画像（og:image）を data/crawled.json に追加する。
// robots.txt を守り、リクエスト間隔を空け、登録ドメインの外には出ない。
import path from 'node:path';
import config from '../site.config.mjs';
import { DATA, readJson, writeFile, uniq } from './util.mjs';
import { loadSources, loadBlocklist } from './ingest.mjs';

const UA_NAME = 'MangaDriveBot';
const UA = `Mozilla/5.0 (compatible; ${UA_NAME}/1.0; +${config.siteUrl}/about/)`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s = '') =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] || '') : '';
}

function pageInfo(html, pageUrl) {
  const abs = (u) => {
    try {
      return u ? new URL(u, pageUrl).href : null;
    } catch {
      return null;
    }
  };
  const img = meta(html, 'og:image') || meta(html, 'twitter:image');
  return {
    title: meta(html, 'og:title') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') || decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ''),
    description: meta(html, 'og:description') || meta(html, 'description'),
    image: abs(img),
    imageAlt: meta(html, 'og:image:alt'),
    author: meta(html, 'author') || meta(html, 'article:author'),
    keywords: meta(html, 'keywords').split(/[,、]/).map((s) => s.trim()).filter(Boolean),
  };
}

function links(html, pageUrl) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const u = new URL(decode(m[1]), pageUrl);
      if (!/^https?:$/.test(u.protocol)) continue;
      const imgAlt = m[2].match(/alt=["']([^"']+)["']/i)?.[1];
      const imgSrc = m[2].match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      out.push({ url: u.href, text: decode(m[2]) || decode(imgAlt || ''), img: imgSrc ? new URL(imgSrc, pageUrl).href : null });
    } catch {}
  }
  return out;
}

// ---------- robots.txt ----------
const robotsCache = new Map();
async function robots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let rules = { allow: [], disallow: [], delay: 0 };
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': UA } });
    if (res.ok) {
      const groups = [];
      let cur = null;
      for (const raw of (await res.text()).split('\n')) {
        const line = raw.replace(/#.*/, '').trim();
        const i = line.indexOf(':');
        if (i < 0) continue;
        const k = line.slice(0, i).trim().toLowerCase();
        const v = line.slice(i + 1).trim();
        if (k === 'user-agent') {
          if (!cur || cur.rulesStarted) groups.push((cur = { agents: [], allow: [], disallow: [], delay: 0 }));
          cur.agents.push(v.toLowerCase());
        } else if (cur) {
          cur.rulesStarted = true;
          if (k === 'allow' && v) cur.allow.push(v);
          if (k === 'disallow' && v) cur.disallow.push(v);
          if (k === 'crawl-delay') cur.delay = Number(v) || 0;
        }
      }
      rules = groups.find((g) => g.agents.includes(UA_NAME.toLowerCase())) || groups.find((g) => g.agents.includes('*')) || rules;
    }
  } catch {}
  robotsCache.set(origin, rules);
  return rules;
}

function allowedBy(rules, url) {
  const p = new URL(url);
  const target = p.pathname + p.search;
  const match = (pat) => {
    const re = new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    return re.test(target) ? pat.length : -1;
  };
  const a = Math.max(-1, ...rules.allow.map(match));
  const d = Math.max(-1, ...rules.disallow.map(match));
  return d < 0 || a >= d;
}

// ---------- 1 サイトの巡回 ----------
async function crawlSite(site, known, budget, defaults) {
  const allow = new Set((site.allow || site.start.map((u) => new URL(u).hostname)).map((h) => h.toLowerCase()));
  const pdfRe = new RegExp(site.pdfPattern || '\\.pdf($|[?#])', 'i');
  const followRe = site.follow ? new RegExp(site.follow, 'i') : null;
  const maxPages = site.maxPages ?? defaults.maxPages;
  const maxDepth = site.maxDepth ?? defaults.maxDepth;
  const queue = site.start.map((u) => [u, 0]);
  const seen = new Set();
  const found = [];
  let pages = 0;

  while (queue.length && pages < maxPages && found.length < budget) {
    const [url, depth] = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const host = new URL(url).hostname.toLowerCase();
    if (!allow.has(host)) continue;
    const rules = await robots(new URL(url).origin);
    if (!allowedBy(rules, url)) {
      console.log(`  robots.txt により除外: ${url}`);
      continue;
    }
    await sleep(Math.max(defaults.delayMs, rules.delay * 1000));
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml;q=0.9,*/*;q=0.5' }, redirect: 'follow' });
    } catch (e) {
      console.warn(`  取得失敗: ${url} (${e.message})`);
      continue;
    }
    pages++;
    if (!res.ok) continue;
    const type = res.headers.get('content-type') || '';
    const body = await res.text();

    // sitemap.xml / RSS
    if (/xml/.test(type) || /^\s*<\?xml/.test(body)) {
      for (const m of body.matchAll(/<(?:loc|link)>\s*([^<\s]+)\s*<\/(?:loc|link)>/gi)) queue.push([decode(m[1]), depth + 1]);
      continue;
    }
    if (!/html/.test(type)) continue;

    const info = pageInfo(body, url);
    const all = links(body, url);
    const pdfs = all.filter((l) => pdfRe.test(l.url));
    for (const l of pdfs) {
      if (known.has(l.url) || found.length >= budget) continue;
      if (!allow.has(new URL(l.url).hostname.toLowerCase()) && !site.allowExternalPdf) continue;
      known.add(l.url);
      // ページに PDF が 1 つならページのタイトルを、複数ならリンク文字列を作品名に使う
      const useLink = pdfs.length > 1 && l.text && !/^(pdf|download|ダウンロード|読む|こちら)$/i.test(l.text);
      found.push({
        url: l.url,
        title: (useLink ? l.text : info.title) || l.text || undefined,
        description: info.description || undefined,
        cover: (pdfs.length > 1 ? l.img : null) || info.image || l.img || undefined,
        coverAlt: info.imageAlt || undefined,
        author: info.author || site.author || undefined,
        genres: uniq([...(site.genres || []), ...info.keywords]).slice(0, 8),
        license: site.license || undefined,
        sourcePage: url,
        sourceSite: site.name,
        foundAt: new Date().toISOString(),
      });
      console.log(`  + ${l.url}`);
    }
    if (depth < maxDepth) {
      for (const l of all) {
        if (pdfRe.test(l.url) || seen.has(l.url)) continue;
        if (!allow.has(new URL(l.url).hostname.toLowerCase())) continue;
        if (followRe && !followRe.test(l.url)) continue;
        if (/\.(jpe?g|png|gif|webp|zip|rar|mp4|mp3|css|js)($|\?)/i.test(l.url)) continue;
        queue.push([l.url.replace(/#.*$/, ''), depth + 1]);
      }
    }
  }
  console.log(`  ${site.name}: ${pages}ページ巡回, 新規PDF ${found.length}件`);
  return found;
}

// ---------- 実行 ----------
const cfg = await readJson(path.join(DATA, 'crawl.json'), { sites: [] });
const defaults = { maxPages: 200, maxDepth: 3, delayMs: 1500, maxNewPerRun: 50, ...cfg.defaults };
const crawledFile = path.join(DATA, 'crawled.json');
const crawled = await readJson(crawledFile, []);
const blocked = await loadBlocklist();
const known = new Set([...(await loadSources()).map((s) => s.url), ...crawled.map((s) => s.url), ...blocked]);

let budget = defaults.maxNewPerRun;
const added = [];
for (const site of cfg.sites.filter((s) => s.enabled !== false && s.start?.length)) {
  if (budget <= 0) break;
  console.log(`クロール: ${site.name}`);
  const found = await crawlSite(site, known, budget, defaults);
  budget -= found.length;
  added.push(...found);
}
if (added.length) await writeFile(crawledFile, JSON.stringify([...crawled, ...added], null, 1));
console.log(`✓ クロール完了: 新規 ${added.length}件（合計 ${crawled.length + added.length}件）`);
