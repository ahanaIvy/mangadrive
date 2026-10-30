// PDF URL を取り込み、PDF・画像のメタデータを抽出して data/cache/<slug>.json に保存する
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import sharp from 'sharp';
import exifr from 'exifr';
import config from '../site.config.mjs';
import { ROOT, CACHE, MEDIA, sha, makeSlug, readJson, writeFile, isoDate, uniq } from './util.mjs';

GlobalFonts.loadSystemFonts?.();

const PDFJS_DIR = path.join(ROOT, 'node_modules', 'pdfjs-dist');
const UA = `Mozilla/5.0 (compatible; MangaDriveBot/1.0; +${config.siteUrl}/about/)`;

// ---------- 取得 ----------
export async function fetchBuffer(url, maxBytes = config.maxPdfBytes) {
  if (!/^https?:/i.test(url)) {
    const p = url.startsWith('file:') ? new URL(url) : path.resolve(ROOT, url);
    const buf = await fs.readFile(p);
    const st = await fs.stat(p);
    return { buf, headers: { 'last-modified': st.mtime.toUTCString(), 'content-length': String(st.size) } };
  }
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > maxBytes) throw new Error(`サイズ上限超過 (${len} bytes)`);
  const chunks = [];
  let total = 0;
  for await (const c of res.body) {
    total += c.length;
    if (total > maxBytes) throw new Error('サイズ上限超過');
    chunks.push(c);
  }
  return { buf: Buffer.concat(chunks), headers: Object.fromEntries(res.headers) };
}

// ---------- PDF の日付 "D:20240101120000+09'00'" → ISO ----------
function pdfDate(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Z+-])?(\d{2})?'?(\d{2})?/);
  if (!m) return isNaN(Date.parse(s)) ? null : new Date(s).toISOString();
  const [, y, mo = '01', d = '01', h = '00', mi = '00', se = '00', tz, th = '00', tm = '00'] = m;
  const off = !tz || tz === 'Z' ? 'Z' : `${tz}${th}:${tm}`;
  const t = new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}${off}`);
  return isNaN(t) ? null : t.toISOString();
}

const splitList = (s) =>
  uniq(
    (Array.isArray(s) ? s : String(s || '').split(/[,、，;；\n]|\s{2,}/))
      .map((x) => String(x).trim())
      .filter((x) => x && x.length <= 40),
  );

// XMP の値は { 'x-default': '...' } や配列のこともある
const xmpVal = (v) => {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(xmpVal).filter(Boolean).join(', ');
  if (typeof v === 'object') return v['x-default'] || Object.values(v)[0] || null;
  return String(v);
};

// ---------- PDF 解析 ----------
export async function analyzePdf(buf) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    verbosity: 0,
    isEvalSupported: false,
    cMapUrl: path.join(PDFJS_DIR, 'cmaps') + '/',
    cMapPacked: true,
    standardFontDataUrl: path.join(PDFJS_DIR, 'standard_fonts') + '/',
  }).promise;

  const { info = {}, metadata } = await doc.getMetadata().catch(() => ({}));
  let xmp = {};
  try {
    xmp = metadata?.getAll?.() || {};
  } catch {}

  const first = await doc.getPage(1);
  const [, , w, h] = first.view;

  // テキスト抽出（漫画は画像中心のため先頭数ページのみ）
  const textParts = [];
  for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent().catch(() => ({ items: [] }));
    textParts.push(tc.items.map((it) => it.str).join(' '));
  }
  const text = textParts.join('\n').replace(/[ \t]+/g, ' ').trim().slice(0, 6000);

  let outline = [];
  try {
    outline = ((await doc.getOutline()) || []).map((o) => o.title).filter(Boolean).slice(0, 50);
  } catch {}

  const xmpTitle = xmpVal(xmp['dc:title']);
  const xmpCreator = xmpVal(xmp['dc:creator']);
  const xmpSubject = xmpVal(xmp['dc:description']);
  const xmpKeywords = xmpVal(xmp['pdf:keywords']) || xmpVal(xmp['dc:subject']);

  const pdfMeta = {
    title: (info.Title || xmpTitle || '').trim() || null,
    author: (info.Author || xmpCreator || '').trim() || null,
    subject: (info.Subject || xmpSubject || '').trim() || null,
    keywords: splitList(info.Keywords || xmpKeywords),
    creator: info.Creator || xmpVal(xmp['xmp:creatortool']) || null,
    producer: info.Producer || xmpVal(xmp['pdf:producer']) || null,
    created: pdfDate(info.CreationDate) || xmpVal(xmp['xmp:createdate']) || null,
    modified: pdfDate(info.ModDate) || xmpVal(xmp['xmp:modifydate']) || null,
    language: info.Language || xmpVal(xmp['dc:language']) || null,
    rights: xmpVal(xmp['dc:rights']) || null,
    publisher: xmpVal(xmp['dc:publisher']) || null,
    pdfVersion: info.PDFFormatVersion || null,
    pages: doc.numPages,
    pageWidthPt: Math.round(w),
    pageHeightPt: Math.round(h),
    orientation: h >= w ? 'portrait' : 'landscape',
    encrypted: !!info.EncryptFilterName,
    linearized: !!info.IsLinearized,
    outline,
    xmp: Object.fromEntries(Object.entries(xmp).map(([k, v]) => [k, xmpVal(v)]).slice(0, 60)),
  };

  return { doc, pdfMeta, text };
}

// ---------- ページを画像化（XMP / EXIF に自サイトのメタデータを埋め込む） ----------
function xmpPacket({ title, author, description, url, keywords }) {
  const x = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">
<dc:title><rdf:Alt><rdf:li xml:lang="ja">${x(title)}</rdf:li></rdf:Alt></dc:title>
<dc:description><rdf:Alt><rdf:li xml:lang="ja">${x(description)}</rdf:li></rdf:Alt></dc:description>
<dc:creator><rdf:Seq><rdf:li>${x(author || config.orgName)}</rdf:li></rdf:Seq></dc:creator>
<dc:subject><rdf:Bag>${(keywords || []).map((k) => `<rdf:li>${x(k)}</rdf:li>`).join('')}</rdf:Bag></dc:subject>
<dc:language><rdf:Bag><rdf:li>ja</rdf:li></rdf:Bag></dc:language>
<photoshop:Credit>${x(config.orgName)}</photoshop:Credit>
<photoshop:Source>${x(config.siteUrl)}</photoshop:Source>
<xmpRights:WebStatement>${x(url)}</xmpRights:WebStatement>
<Iptc4xmpCore:CreatorContactInfo rdf:parseType="Resource"><Iptc4xmpCore:CiUrlWork>${x(config.siteUrl)}</Iptc4xmpCore:CiUrlWork></Iptc4xmpCore:CreatorContactInfo>
</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

async function renderPage(doc, n, width) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: width / base.width });
  const cv = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: ctx, viewport: vp, canvas: cv }).promise;
  return cv.toBuffer('image/png');
}

const asciiExif = (s) => String(s || '').replace(/[^\x20-\x7e]/g, '').slice(0, 200);

async function saveImage(png, file, meta, { width, height, fit = 'inside' } = {}) {
  const img = sharp(png).resize({ width, height, fit, background: '#111' });
  await fs.mkdir(path.dirname(file), { recursive: true });
  const info = await img
    .withExif({
      IFD0: {
        ImageDescription: asciiExif(meta.titleAscii) || config.orgName,
        Artist: asciiExif(meta.author) || config.orgName,
        Copyright: `${asciiExif(meta.author) || 'Rights holder'} / ${config.orgName} (${config.domain})`,
        Software: `${config.orgName} builder`,
      },
    })
    .withXmp(xmpPacket(meta))
    .webp({ quality: 80 })
    .toFile(file);
  return { width: info.width, height: info.height, bytes: info.size };
}

export async function renderImages(doc, slug, meta) {
  const dir = path.join(MEDIA, slug);
  const out = { cover: null, og: null, previews: [] };
  const coverPng = await renderPage(doc, 1, 900);
  out.cover = { path: `media/${slug}/cover.webp`, ...(await saveImage(coverPng, path.join(dir, 'cover.webp'), meta, { width: 600 })) };
  // OGP 1200x630（表紙を中央に配置）
  const ogCover = await sharp(coverPng).resize({ height: 630, fit: 'inside' }).png().toBuffer();
  const ogPng = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#14121a' } })
    .composite([{ input: ogCover, gravity: 'center' }])
    .png()
    .toBuffer();
  out.og = { path: `media/${slug}/og.webp`, ...(await saveImage(ogPng, path.join(dir, 'og.webp'), meta, { width: 1200, height: 630, fit: 'cover' })) };
  for (let i = 2; i <= Math.min(doc.numPages, config.previewPages + 1); i++) {
    const png = await renderPage(doc, i, 700);
    const info = await saveImage(png, path.join(dir, `p${i}.webp`), { ...meta, title: `${meta.title} ${i}ページ` }, { width: 480 });
    out.previews.push({ page: i, path: `media/${slug}/p${i}.webp`, ...info });
  }
  return out;
}

// ---------- 外部画像（表紙URLなど）のメタデータ ----------
export async function analyzeImage(url) {
  try {
    const { buf } = await fetchBuffer(url, 20 * 1024 * 1024);
    const [m, exif] = await Promise.all([sharp(buf).metadata(), exifr.parse(buf, { xmp: true, iptc: true, icc: false }).catch(() => ({}))]);
    const e = exif || {};
    return {
      buf,
      imageMeta: {
        source: url,
        format: m.format,
        width: m.width,
        height: m.height,
        title: e.title?.value || e.title || e.ObjectName || e.ImageDescription || null,
        description: e.description?.value || e.description || e.Caption || e.ImageDescription || null,
        author: e.Artist || e.creator || e.Byline || null,
        copyright: e.Copyright || e.rights?.value || e.rights || e.CopyrightNotice || null,
        keywords: splitList(e.Keywords || e.subject || e.XPKeywords || []),
        created: e.DateTimeOriginal ? isoDate(e.DateTimeOriginal) : e.CreateDate ? isoDate(e.CreateDate) : null,
        software: e.Software || null,
      },
    };
  } catch (err) {
    console.warn(`  画像メタデータ取得失敗: ${url} (${err.message})`);
    return { buf: null, imageMeta: null };
  }
}

// ---------- 1件取り込み ----------
export async function ingestOne(src) {
  const url = src.url;
  console.log(`→ 取り込み: ${url}`);
  const { buf, headers } = await fetchBuffer(url);
  if (buf.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDFではありません');
  const { doc, pdfMeta, text } = await analyzePdf(buf);

  const fileName = decodeURIComponent(path.basename(new URL(url, pathToFileURL(ROOT + '/')).pathname)).replace(/\.pdf$/i, '');
  const title = src.title || pdfMeta.title || fileName.replace(/[_-]+/g, ' ').trim() || '無題の漫画';
  const slug = src.slug || makeSlug(title, url);
  const author = src.author || pdfMeta.author || null;

  let imageMeta = null;
  let images;
  const meta = {
    title,
    titleAscii: /[a-z]/i.test(title) ? title : fileName,
    author,
    description: src.description || pdfMeta.subject || title,
    url: `${config.siteUrl}/manga/${slug}/`,
    keywords: uniq([...(src.genres || []), ...pdfMeta.keywords]),
  };
  if (src.cover) {
    const r = await analyzeImage(src.cover);
    imageMeta = r.imageMeta;
    images = await renderImages(doc, slug, meta);
    if (r.buf) {
      const dir = path.join(MEDIA, slug);
      images.cover = { path: `media/${slug}/cover.webp`, ...(await saveImage(r.buf, path.join(dir, 'cover.webp'), meta, { width: 600 })) };
    }
  } else {
    images = await renderImages(doc, slug, meta);
  }
  await (doc.destroy?.() ?? doc.cleanup?.());

  return {
    id: sha(url, 12),
    slug,
    url,
    title,
    author,
    sourceTitle: pdfMeta.title,
    genres: uniq([...(src.genres || []), ...pdfMeta.keywords]).slice(0, 12),
    series: src.series || null,
    volume: src.volume || null,
    overrides: src,
    file: {
      bytes: buf.length,
      sha256: sha(buf, 64),
      mime: 'application/pdf',
      lastModified: headers['last-modified'] ? isoDate(headers['last-modified']) : null,
      etag: headers.etag || null,
    },
    pdfMeta,
    imageMeta,
    images,
    textExcerpt: text,
    addedAt: isoDate(),
    updatedAt: isoDate(),
  };
}

// ---------- ソース一覧を読む（txt / json / リモートフィード） ----------
function parseSourceText(txt) {
  return txt
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      // 形式: URL | title=… | author=… | cover=… | genres=a,b
      const [url, ...rest] = l.split('|').map((s) => s.trim());
      const o = { url };
      for (const kv of rest) {
        const i = kv.indexOf('=');
        if (i < 0) continue;
        const k = kv.slice(0, i).trim();
        const v = kv.slice(i + 1).trim();
        o[k] = k === 'genres' ? splitList(v) : v;
      }
      return o;
    });
}

export async function loadSources() {
  const list = [];
  const txt = await fs.readFile(path.join(ROOT, 'data', 'sources.txt'), 'utf8').catch(() => '');
  list.push(...parseSourceText(txt));
  list.push(...(await readJson(path.join(ROOT, 'data', 'sources.json'), [])).map((s) => (typeof s === 'string' ? { url: s } : s)));
  list.push(...(await readJson(path.join(ROOT, 'data', 'crawled.json'), []))); // src/crawl.mjs が自動追加
  for (const feed of String(process.env.SOURCES_FEED_URL || '').split(/\s+/).filter(Boolean)) {
    try {
      const { buf } = await fetchBuffer(feed, 5 * 1024 * 1024);
      const body = buf.toString('utf8');
      if (body.trim().startsWith('[')) list.push(...JSON.parse(body).map((s) => (typeof s === 'string' ? { url: s } : s)));
      else list.push(...parseSourceText(body.replace(/,/g, ' | ').replace(/^"|"$/gm, '')));
      console.log(`フィード読み込み: ${feed}`);
    } catch (e) {
      console.warn(`フィード取得失敗: ${feed} (${e.message})`);
    }
  }
  const blocked = new Set(
    (await fs.readFile(path.join(ROOT, 'data', 'blocklist.txt'), 'utf8').catch(() => ''))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
  const seen = new Set();
  return list.filter((s) => {
    if (!s.url || seen.has(s.url) || blocked.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

export async function loadBlocklist() {
  return new Set(
    (await fs.readFile(path.join(ROOT, 'data', 'blocklist.txt'), 'utf8').catch(() => ''))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
}

export const cacheFile = (url) => path.join(CACHE, `${sha(url, 12)}.json`);
export const saveRecord = (rec) => writeFile(cacheFile(rec.url), JSON.stringify(rec, null, 2));
