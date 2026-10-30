// MangaDrive ビルド：取り込み → コンテンツ生成 → 静的サイト出力
// 使い方: node src/build.mjs [--refresh] [--regen] [--no-ingest]
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../site.config.mjs';
import { ROOT, CACHE, MEDIA, DIST, sha, esc, clip, readJson, writeFile, jaDate, formatBytes, tagSlug, uniq } from './util.mjs';
import { loadSources, loadBlocklist, ingestOne, saveRecord, cacheFile } from './ingest.mjs';
import { generateContent } from './content.mjs';
import { layout, listPage, mangaPage, grid, jotaroBlock, jotaroNode, jotaroItemList, mangaUrl, genreUrl, authorUrl, SITE_ID } from './render.mjs';
import { aboutPage, contactPage, termsPage, privacyPage, dmcaPage, editorialPage, jotaroPage } from './pages.mjs';

const args = new Set(process.argv.slice(2));
const S = config.siteUrl;
const out = (p, c) => writeFile(path.join(DIST, p), c);

// ---------- 1. 取り込み ----------
async function ingestAll() {
  const sources = await loadSources();
  const blocked = await loadBlocklist();
  console.log(`ソース: ${sources.length}件`);
  const records = [];
  const queue = [...sources];
  const failed = [];
  async function worker() {
    while (queue.length) {
      const src = queue.shift();
      let rec = await readJson(cacheFile(src.url), null);
      try {
        if (!rec && args.has('--no-ingest')) continue;
        if (!rec || args.has('--refresh') || JSON.stringify(rec.overrides) !== JSON.stringify(src)) {
          const prev = rec;
          rec = await ingestOne(src);
          if (prev) {
            rec.addedAt = prev.addedAt;
            if (prev.file?.sha256 === rec.file.sha256 && prev.content && !args.has('--regen')) rec.content = prev.content;
          }
        }
        const upgradeToAi = rec.content?.generatedBy === 'template' && process.env.ANTHROPIC_API_KEY && process.env.AI_UPGRADE !== 'off';
        if (!rec.content || args.has('--regen') || upgradeToAi) {
          rec.content = await generateContent(rec);
          rec.updatedAt = new Date().toISOString();
        }
        await saveRecord(rec);
        records.push(rec);
      } catch (e) {
        console.warn(`✗ ${src.url}: ${e.message}`);
        failed.push({ url: src.url, error: e.message });
        if (rec?.content && rec?.images) records.push(rec); // 一時的な失敗ならキャッシュで継続
      }
    }
  }
  await Promise.all(Array.from({ length: Number(process.env.CONCURRENCY || 2) }, worker));

  // ブロックリスト（DMCA）に入った作品のキャッシュとメディアを完全削除
  for (const f of await fs.readdir(CACHE).catch(() => [])) {
    const r = await readJson(path.join(CACHE, f), null);
    if (r && (blocked.has(r.url) || blocked.has(r.slug))) {
      await fs.rm(path.join(CACHE, f), { force: true });
      await fs.rm(path.join(MEDIA, r.slug), { recursive: true, force: true });
      console.log(`DMCA削除: ${r.slug}`);
    }
  }
  await writeFile(path.join(ROOT, 'data', 'ingest-report.json'), JSON.stringify({ at: new Date().toISOString(), ok: records.length, failed }, null, 2));
  return records.filter((r) => !blocked.has(r.url) && !blocked.has(r.slug)).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

// ---------- 関連作品・Jotaro ピック ----------
function relatedFor(r, all) {
  const score = (x) =>
    x.content.genres.filter((g) => r.content.genres.includes(g)).length * 3 +
    (x.author && x.author === r.author ? 4 : 0) +
    (x.series && x.series === r.series ? 6 : 0);
  return all
    .filter((x) => x !== r)
    .map((x) => [score(x), parseInt(sha(r.slug + x.slug, 6), 16), x])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, config.relatedCount)
    .map((a) => a[2]);
}

function externalPicks(list) {
  return list.map((p) => ({ title: p.title, author: p.author, note: p.note, image: p.image, href: p.url, external: !p.url.startsWith(S) && !p.url.startsWith('/') }));
}

function internalPicks(all) {
  // Jotaro が自動で選ぶ：AI生成コンテンツ優先 → ページ数 → 新着
  return [...all]
    .sort((a, b) => (b.content.generatedBy === 'ai') - (a.content.generatedBy === 'ai') || b.pdfMeta.pages - a.pdfMeta.pages || b.addedAt.localeCompare(a.addedAt))
    .slice(0, 12)
    .map((r) => ({ title: r.title, author: r.author, note: r.content.jotaroComment, image: `/${r.images.cover.path}`, href: `/manga/${r.slug}/` }));
}

function picksFor(r, ext, int) {
  const pool = [...ext, ...int.filter((p) => p.href !== `/manga/${r.slug}/`)];
  return pool
    .map((p) => [parseInt(sha(r.slug + p.href, 6), 16), p])
    .sort((a, b) => a[0] - b[0])
    .slice(0, config.jotaroPicksPerPost)
    .map((a) => a[1]);
}

// ---------- Markdown 版（AI クローラー向け） ----------
function mangaMarkdown(r) {
  const c = r.content;
  const m = r.pdfMeta;
  return `# ${r.title}

> ${c.answer}

- 作者: ${r.author || '不明'}
- ページ数: ${m.pages}
- ジャンル: ${c.genres.join('、')}
- 形式: PDF（${formatBytes(r.file.bytes)}）
- PDF: ${r.url}
- 作品ページ: ${mangaUrl(r)}
- 掲載: ${config.orgName}（${S}）

## あらすじ・作品紹介
${c.summary.join('\n\n')}

## 見どころ
${c.highlights.map((h) => `- ${h}`).join('\n')}

## よくある質問
${c.faq.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

## ${config.curator.name}のひとこと
${c.jotaroComment}
`;
}

// ---------- 2. サイト出力 ----------
async function buildSite(all) {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.cp(path.join(ROOT, 'public'), DIST, { recursive: true });
  for (const r of all) await fs.cp(path.join(MEDIA, r.slug), path.join(DIST, 'media', r.slug), { recursive: true }).catch(() => {});

  const ext = externalPicks(await readJson(path.join(ROOT, 'data', 'jotaro.json'), []));
  const int = internalPicks(all);
  const urls = []; // sitemap 用 [path, lastmod, images[]]

  // 作品ページ
  for (const r of all) {
    await out(`manga/${r.slug}/index.html`, mangaPage(r, { related: relatedFor(r, all), picks: picksFor(r, ext, int) }));
    await out(`manga/${r.slug}/index.md`, mangaMarkdown(r));
    urls.push([`/manga/${r.slug}/`, r.updatedAt, [r.images.cover, ...r.images.previews].map((i) => ({ loc: `${S}/${i.path}`, title: r.title }))]);
  }

  // 作品一覧（ページ分割）
  const per = config.postsPerPage;
  const pages = Math.max(1, Math.ceil(all.length / per));
  for (let p = 1; p <= pages; p++) {
    const pth = p === 1 ? '/manga/' : `/manga/page/${p}/`;
    await out(`${pth.slice(1)}index.html`, listPage({ title: '漫画作品一覧', h1: '漫画作品一覧', intro: `${config.orgName}に掲載中の漫画作品（全${all.length}作品）を新着順に掲載しています。`, path: pth, items: all.slice((p - 1) * per, p * per), crumbs: [['ホーム', `${S}/`], ['作品一覧', `${S}/manga/`]], pageNum: p, totalPages: pages, basePath: '/manga/' }));
    urls.push([pth, all[0]?.updatedAt]);
  }

  // ジャンル・作者
  const groups = (key) => {
    const map = new Map();
    for (const r of all) for (const k of key(r)) map.set(k, [...(map.get(k) || []), r]);
    return [...map].sort((a, b) => b[1].length - a[1].length);
  };
  const genres = groups((r) => r.content.genres);
  for (const [g, items] of genres) {
    const pth = `/genre/${encodeURIComponent(tagSlug(g))}/`;
    await out(`genre/${tagSlug(g)}/index.html`, listPage({ title: `${g}の漫画一覧`, h1: `「${g}」の漫画一覧`, intro: `${config.orgName}で読める「${g}」ジャンルの漫画は${items.length}作品です。作品ごとのあらすじ・ページ数・PDF情報を掲載しています。`, path: pth, items, crumbs: [['ホーム', `${S}/`], ['ジャンル', `${S}/genre/`], [g, `${S}${pth}`]] }));
    urls.push([pth, items[0].updatedAt]);
  }
  await out(
    'genre/index.html',
    layout({
      title: 'ジャンル一覧',
      description: `${config.orgName}の漫画をジャンル別に探せます。全${genres.length}ジャンル。`,
      path: '/genre/',
      crumbs: [['ホーム', `${S}/`], ['ジャンル', `${S}/genre/`]],
      body: `<h1>ジャンル一覧</h1><p class="lead">${config.orgName}の漫画を${genres.length}のジャンルから探せます。</p><p class="tags big">${genres.map(([g, i]) => `<a class="tag" href="/genre/${encodeURIComponent(tagSlug(g))}/">${esc(g)} <small>${i.length}</small></a>`).join('')}</p>`,
    }),
  );
  urls.push(['/genre/']);
  for (const [a, items] of groups((r) => (r.author ? [r.author] : []))) {
    const pth = `/author/${encodeURIComponent(tagSlug(a))}/`;
    await out(
      `author/${tagSlug(a)}/index.html`,
      listPage({
        title: `${a}の漫画作品一覧`,
        h1: `${a}の作品一覧`,
        intro: `${a}の漫画作品は${config.orgName}に${items.length}作品掲載されています。`,
        path: pth,
        items,
        crumbs: [['ホーム', `${S}/`], ['作品一覧', `${S}/manga/`], [a, `${S}${pth}`]],
        extraJsonld: [{ '@type': 'Person', '@id': `${S}${pth}#person`, name: a, url: `${S}${pth}` }],
      }),
    );
    urls.push([pth, items[0].updatedAt]);
  }

  // トップページ
  const homeFaq = [
    { q: `${config.orgName}とは何ですか？`, a: config.description },
    { q: `${config.orgName}ではどんな漫画が読めますか？`, a: `PDF形式で公開されている漫画作品を${all.length}作品掲載しています。${genres.slice(0, 5).map((g) => g[0]).join('、')}などのジャンルがあります。` },
    { q: '漫画はどうやって読めますか？', a: '各作品ページのオンラインリーダーで、アプリ不要のままブラウザで読めます。' },
    { q: `${config.curator.name}とは誰ですか？`, a: config.curator.bio },
  ];
  await out(
    'index.html',
    layout({
      title: `${config.orgName}（${config.orgNameJa}）｜${config.tagline}`,
      description: config.description,
      path: '/',
      jsonld: [
        { '@type': 'CollectionPage', '@id': `${S}/#webpage`, url: `${S}/`, name: config.orgName, isPartOf: { '@id': SITE_ID }, inLanguage: 'ja', about: { '@id': `${S}/#organization` } },
        { '@type': 'FAQPage', '@id': `${S}/#faq`, mainEntity: homeFaq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        jotaroNode(),
        ...(int.length ? [jotaroItemList(int.slice(0, 6), `${S}/`)] : []),
      ],
      body: `<section class="hero"><h1>${esc(config.orgName)} — ${esc(config.tagline)}</h1><p class="answer">${esc(config.description)}</p><p class="muted">掲載作品 ${all.length}作品 · ${genres.length}ジャンル · 毎日自動更新</p></section>
<section><h2>新着の漫画</h2>${all.length ? grid(all.slice(0, 12)) : '<p class="muted">作品は準備中です。</p>'}<p><a class="btn ghost" href="/manga/">すべての作品を見る</a></p></section>
${genres.length ? `<section><h2>ジャンルから探す</h2><p class="tags big">${genres.slice(0, 30).map(([g, i]) => `<a class="tag" href="/genre/${encodeURIComponent(tagSlug(g))}/">${esc(g)} <small>${i.length}</small></a>`).join('')}</p></section>` : ''}
${jotaroBlock([...int.slice(0, 4), ...ext.slice(0, 4)])}
<section class="faq"><h2>よくある質問</h2>${homeFaq.map((f) => `<details open><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('')}</section>`,
    }),
  );
  urls.unshift(['/', all[0]?.updatedAt]);

  // 組織ページ
  const statics = [
    ['about', aboutPage({ count: all.length })],
    ['contact', contactPage()],
    ['terms', termsPage()],
    ['privacy', privacyPage()],
    ['dmca', dmcaPage()],
    ['editorial-policy', editorialPage()],
    ['jotaro', jotaroPage(ext, int)],
  ];
  for (const [p, html] of statics) {
    await out(`${p}/index.html`, html);
    urls.push([`/${p}/`]);
  }

  // 検索
  await out(
    'search/index.html',
    layout({ title: 'サイト内検索', description: `${config.orgName}の漫画を作品名・作者・ジャンルで検索できます。`, path: '/search/', noindex: true, body: `<h1>サイト内検索</h1><form class="search-form big" action="/search/" role="search"><input type="search" name="q" id="q" placeholder="作品名・作者・ジャンル" aria-label="検索キーワード"><button>検索</button></form><div id="results" class="grid"></div>` }),
  );
  await out('search.json', JSON.stringify(all.map((r) => ({ s: r.slug, t: r.title, a: r.author || '', g: r.content.genres, c: `/${r.images.cover.path}`, p: r.pdfMeta.pages, d: clip(r.content.answer, 80) }))));
  await out('404.html', layout({ title: 'ページが見つかりません', description: 'お探しのページは見つかりませんでした。', path: '/404.html', noindex: true, body: `<h1>ページが見つかりません（404）</h1><p>お探しのページは移動または削除された可能性があります。</p><p><a class="btn" href="/">トップへ戻る</a></p>${grid(all.slice(0, 6))}` }));

  await seoFiles(all, urls, genres);
  return urls;
}

// ---------- 3. SEO / AIO ファイル ----------
async function seoFiles(all, urls, genres) {
  const now = new Date().toISOString();
  const x = (s) => esc(s);
  await out(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    ([p, lm, imgs = []]) =>
      `<url><loc>${x(S + p)}</loc><lastmod>${lm || now}</lastmod>${imgs.map((i) => `<image:image><image:loc>${x(i.loc)}</image:loc></image:image>`).join('')}</url>`,
  )
  .join('\n')}
</urlset>`,
  );

  await out(
    'robots.txt',
    `# ${config.orgName} robots.txt
User-agent: *
Allow: /
Disallow: /search/
Disallow: /pdf

# AI 検索・回答エンジンを歓迎します
User-agent: Googlebot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Bingbot
Allow: /
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Applebot-Extended
Allow: /

Sitemap: ${S}/sitemap.xml
`,
  );

  // llms.txt — AI 向けのサイト概要（https://llmstxt.org）
  await out(
    'llms.txt',
    `# ${config.orgName}

> ${config.description}

${config.orgName}（${config.orgNameJa}）は ${config.domain} を運営する組織です。掲載作品は${all.length}作品。各作品ページには、PDFメタデータ（タイトル・作者・ページ数・作成日）、あらすじ、見どころ、FAQ を掲載しています。各作品ページの Markdown 版は URL の末尾に index.md を付けると取得できます。

## 組織情報
- [運営者情報](${S}/about/): 組織概要・ミッション・連絡先
- [編集方針](${S}/editorial-policy/): 情報の収集方法と訂正ポリシー
- [${config.curator.name}のおすすめリスト](${S}/jotaro/): キュレーター${config.curator.name}による厳選漫画
- [DMCA・著作権](${S}/dmca/): 削除申し立て窓口
- [作品データ(JSON)](${S}/api/manga.json): 全作品のメタデータ

## ジャンル
${genres.slice(0, 40).map(([g, i]) => `- [${g}](${S}/genre/${encodeURIComponent(tagSlug(g))}/): ${i.length}作品`).join('\n')}

## 作品
${all.map((r) => `- [${r.title}](${S}/manga/${r.slug}/index.md): ${clip(r.content.answer, 100)}`).join('\n')}
`,
  );
  await out('llms-full.txt', `# ${config.orgName} 全作品データ\n\n> ${config.description}\n\n` + all.map(mangaMarkdown).join('\n---\n\n'));

  // 公開 JSON カタログ
  await out(
    'api/manga.json',
    JSON.stringify(
      {
        publisher: config.orgName,
        url: S,
        updated: now,
        count: all.length,
        items: all.map((r) => ({
          url: mangaUrl(r),
          title: r.title,
          author: r.author,
          genres: r.content.genres,
          pages: r.pdfMeta.pages,
          summary: r.content.answer,
          pdf: r.url,
          cover: `${S}/${r.images.cover.path}`,
          pdfMeta: { ...r.pdfMeta, xmp: undefined },
          imageMeta: r.imageMeta,
          published: r.addedAt,
          modified: r.updatedAt,
        })),
      },
      null,
      1,
    ),
  );

  // RSS
  await out(
    'feed.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${x(config.orgName)} 新着漫画</title>
<link>${S}/</link>
<description>${x(config.description)}</description>
<language>ja</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<atom:link href="${S}/feed.xml" rel="self" type="application/rss+xml"/>
${all
  .slice(0, 50)
  .map(
    (r) => `<item><title>${x(r.title)}</title><link>${mangaUrl(r)}</link><guid isPermaLink="true">${mangaUrl(r)}</guid><pubDate>${new Date(r.addedAt).toUTCString()}</pubDate><description>${x(r.content.metaDescription)}</description>${r.content.genres.map((g) => `<category>${x(g)}</category>`).join('')}<media:content url="${S}/${r.images.cover.path}" medium="image"/></item>`,
  )
  .join('\n')}
</channel>
</rss>`,
  );

  await out(
    'manifest.webmanifest',
    JSON.stringify({ name: config.orgName, short_name: config.orgName, lang: 'ja', start_url: '/', display: 'standalone', background_color: '#0f0e13', theme_color: '#e63946', icons: [{ src: '/assets/logo.png', sizes: '512x512', type: 'image/png' }] }),
  );
  await out(`${config.indexNowKey}.txt`, config.indexNowKey);
}

const all = await ingestAll();
const urls = await buildSite(all);
console.log(`✓ ビルド完了: ${all.length}作品, ${urls.length}ページ → dist/`);
