// HTML テンプレート
import config from '../site.config.mjs';
import { esc, clip, jaDate, formatBytes, tagSlug } from './util.mjs';

const S = config.siteUrl;
export const ORG_ID = `${S}/#organization`;
export const SITE_ID = `${S}/#website`;
export const JOTARO_ID = `${S}/jotaro/#person`;
const abs = (p) => (/^https?:/.test(p) ? p : `${S}/${String(p).replace(/^\//, '')}`);
export const mangaUrl = (r) => `${S}/manga/${r.slug}/`;
export const genreUrl = (g) => `${S}/genre/${encodeURIComponent(tagSlug(g))}/`;
export const authorUrl = (a) => `${S}/author/${encodeURIComponent(tagSlug(a))}/`;

export const orgNode = () => ({
  '@type': 'Organization',
  '@id': ORG_ID,
  name: config.orgName,
  alternateName: config.orgNameJa,
  url: `${S}/`,
  logo: { '@type': 'ImageObject', url: `${S}/assets/logo.png`, width: 512, height: 512 },
  description: config.description,
  foundingDate: config.foundingDate,
  email: config.email.contact,
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'customer support', email: config.email.contact, availableLanguage: ['ja'], url: `${S}/contact/` },
    { '@type': 'ContactPoint', contactType: 'copyright', email: config.email.dmca, availableLanguage: ['ja', 'en'], url: `${S}/dmca/` },
  ],
  publishingPrinciples: `${S}/editorial-policy/`,
  ...(config.sameAs.length ? { sameAs: config.sameAs } : {}),
  employee: { '@id': JOTARO_ID },
});

export const websiteNode = () => ({
  '@type': 'WebSite',
  '@id': SITE_ID,
  url: `${S}/`,
  name: config.orgName,
  alternateName: config.orgNameJa,
  description: config.description,
  inLanguage: 'ja',
  publisher: { '@id': ORG_ID },
  potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${S}/search/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
});

export const jotaroNode = () => ({
  '@type': 'Person',
  '@id': JOTARO_ID,
  name: config.curator.name,
  url: `${S}/jotaro/`,
  jobTitle: config.curator.role,
  description: config.curator.bio,
  worksFor: { '@id': ORG_ID },
  knowsAbout: ['漫画', 'マンガ', 'コミック', '同人誌', 'Webコミック'],
  knowsLanguage: 'ja',
});

export const breadcrumb = (items, url) => ({
  '@type': 'BreadcrumbList',
  '@id': `${url}#breadcrumb`,
  itemListElement: items.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(u) })),
});

const crumbsHtml = (items) =>
  `<nav class="crumbs" aria-label="パンくずリスト"><ol>${items
    .map(([n, u], i) => (i === items.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${esc(u.replace(S, '') || '/')}">${esc(n)}</a></li>`))
    .join('')}</ol></nav>`;

const ICON = {
  search: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.39A8 8 0 1 1 10 2m0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg>',
  list: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>',
  rank: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 21v-8h5v8zm6.5 0V3h5v18zM16 21v-12h5v12z"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10m0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6"/></svg>',
};
const navItems = [['/', 'ホーム'], ['/manga/', '作品一覧'], ['/ranking/', 'ランキング'], ['/genre/', 'ジャンル'], ['/jotaro/', 'Jotaro']];
const tabItems = [['/', 'ホーム', 'home'], ['/manga/', '作品', 'list'], ['/ranking/', 'ランキング', 'rank'], ['/search/', '検索', 'search'], ['/jotaro/', 'Jotaro', 'user']];

// ---------- レイアウト ----------
export function layout({ title, description, path, body, jsonld = [], image, type = 'website', crumbs, extraHead = '', noindex = false, published, modified, keywords = [] }) {
  const url = `${S}${path}`;
  const ogImage = abs(image || 'assets/og-default.png');
  const graph = { '@context': 'https://schema.org', '@graph': [orgNode(), websiteNode(), ...(crumbs ? [breadcrumb(crumbs, url)] : []), ...jsonld] };
  const fullTitle = path === '/' ? title : `${title} | ${config.orgName}`;
  return `<!doctype html>
<html lang="ja" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ja" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">
${keywords.length ? `<meta name="keywords" content="${esc(keywords.join(','))}">\n` : ''}<meta name="author" content="${esc(config.orgName)}">
<meta name="publisher" content="${esc(config.orgName)}">
<meta name="theme-color" content="#e63946">
<meta property="og:site_name" content="${esc(config.orgName)}">
<meta property="og:locale" content="${config.locale}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:alt" content="${esc(title)}">
${published ? `<meta property="article:published_time" content="${published}">\n<meta property="article:modified_time" content="${modified || published}">\n<meta property="article:publisher" content="${S}/about/">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/logo.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${esc(config.orgName)} 新着漫画" href="/feed.xml">
<link rel="stylesheet" href="/assets/style.css">
${extraHead}<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#main">本文へスキップ</a>
<header class="site-header">
  <div class="wrap header-in">
    <a class="logo" href="/" aria-label="${esc(config.orgName)} トップ"><span class="logo-mark">M</span><span>${esc(config.orgName)}</span></a>
    <nav class="main-nav" aria-label="メインメニュー">${navItems.map(([h, t]) => `<a href="${h}"${path === h ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
    <form class="search-form" action="/search/" role="search"><input type="search" name="q" placeholder="作品・作者・ジャンル" aria-label="サイト内検索"><button type="submit" aria-label="検索">${ICON.search}</button></form>
  </div>
</header>
<main id="main" class="wrap">
${crumbs ? crumbsHtml(crumbs) : ''}
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-in">
    <div>
      <p class="logo"><span class="logo-mark">M</span><span>${esc(config.orgName)}</span></p>
      <p class="muted">${esc(config.description)}</p>
    </div>
    <nav aria-label="フッターメニュー">
      <a href="/about/">運営者情報</a><a href="/editorial-policy/">編集方針</a><a href="/contact/">お問い合わせ</a><a href="/terms/">利用規約</a><a href="/privacy/">プライバシーポリシー</a><a href="/dmca/">DMCA・著作権</a><a href="/feed.xml">RSS</a><a href="/sitemap.xml">サイトマップ</a>
    </nav>
  </div>
  <p class="wrap copy">© ${new Date().getFullYear()} ${esc(config.orgName)} (${esc(config.domain)}). All rights reserved.</p>
</footer>
<nav class="tabbar" aria-label="モバイルメニュー">${tabItems.map(([h, t, i]) => `<a href="${h}"${path === h ? ' aria-current="page"' : ''}>${ICON[i]}<span>${t}</span></a>`).join('')}</nav>
<script src="/assets/app.js" defer></script>
</body>
</html>`;
}

// ---------- カード ----------
const isNew = (r) => Date.now() - new Date(r.addedAt).getTime() < 7 * 864e5;
const coverImg = (r, lazy, cls = '') =>
  `<img${cls ? ` class="${cls}"` : ''} src="/${r.images.cover.path}" width="${r.images.cover.width}" height="${r.images.cover.height}" alt="${esc(r.title)} 表紙" ${lazy ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'}>`;

export const card = (r, { lazy = true, rank } = {}) => `<article class="card">
  <a href="/manga/${r.slug}/">
    <span class="thumb">${coverImg(r, lazy)}${isNew(r) ? '<span class="badge">NEW</span>' : ''}<span class="pages">${r.pdfMeta.pages}P</span>${rank ? `<span class="rank-no">${rank}</span>` : ''}</span>
    <h3>${esc(r.title)}</h3>
  </a>
  <p class="meta">${r.author ? esc(r.author) : esc(r.content?.genres?.[0] || '漫画')}</p>
</article>`;

export const grid = (list, opts) => `<div class="grid">${list.map((r, i) => card(r, { lazy: i > 5, ...opts })).join('')}</div>`;

// 横スクロールの棚
export const row = (title, list, more) =>
  list.length
    ? `<section class="shelf"><div class="shelf-head"><h2>${esc(title)}</h2>${more ? `<a href="${more}">もっと見る ›</a>` : ''}</div><div class="row">${list.map((r) => card(r)).join('')}</div></section>`
    : '';

// トップのヒーローバナー（CSS スクロールスナップのカルーセル）
export const hero = (list) =>
  list.length
    ? `<section class="hero-slider" aria-label="注目作品"><div class="slides">${list
        .map(
          (r, i) => `<a class="slide" href="/manga/${r.slug}/" style="--art:url('/${r.images.cover.path}')">
  ${coverImg(r, i > 0, 'slide-cover')}
  <span class="slide-text"><span class="eyebrow">${i === 0 ? '今週の注目' : esc(r.content.genres[0] || 'おすすめ')}</span><strong>${esc(r.title)}</strong><span class="slide-desc">${esc(clip(r.content.answer, 90))}</span><span class="btn">読む</span></span>
</a>`,
        )
        .join('')}</div><div class="dots">${list.map((_, i) => `<span data-i="${i}"></span>`).join('')}</div></section>`
    : '';

// ランキング（大きな順位番号つき）
export const ranking = (list) =>
  `<ol class="ranking">${list
    .map(
      (r, i) => `<li><a href="/manga/${r.slug}/"><span class="no">${i + 1}</span>${coverImg(r, i > 3)}<span class="info"><strong>${esc(r.title)}</strong><small>${esc(r.author || r.content.genres[0] || '')}</small><small class="muted">${r.pdfMeta.pages}ページ · ${esc(r.content.genres.slice(0, 2).join(' / '))}</small></span></a></li>`,
    )
    .join('')}</ol>`;

// ---------- Jotaro のおすすめ ----------
export function jotaroBlock(picks, { heading = `${config.curator.name}のおすすめリスト`, url } = {}) {
  if (!picks.length) return '';
  return `<section class="jotaro" aria-labelledby="jotaro-h">
  <div class="jotaro-head">
    <a href="/jotaro/" class="avatar" aria-hidden="true">J</a>
    <div>
      <h2 id="jotaro-h">${esc(heading)}</h2>
      <p class="muted">ネットで見つけた本当に面白い漫画を、<a href="/jotaro/">${esc(config.curator.name)}</a>（${esc(config.curator.role)}）が厳選して公開しています。</p>
    </div>
  </div>
  <ol class="picks">
    ${picks
      .map(
        (p) => `<li>
      <a href="${esc(p.href)}"${p.external ? ' rel="noopener nofollow ugc" target="_blank"' : ''}>${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" width="64" height="90">` : ''}<span><strong>${esc(p.title)}</strong>${p.author ? `<small>${esc(p.author)}</small>` : ''}</span></a>
      ${p.note ? `<p>「${esc(p.note)}」</p>` : ''}
    </li>`,
      )
      .join('')}
  </ol>
</section>`;
}

export const jotaroItemList = (picks, url) => ({
  '@type': 'ItemList',
  '@id': `${url}#jotaro-picks`,
  name: `${config.curator.name}のおすすめ漫画リスト`,
  author: { '@id': JOTARO_ID },
  itemListElement: picks.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.title, url: abs(p.href) })),
});

// ---------- 作品ページ ----------
export function mangaPage(r, { related, picks }) {
  const c = r.content;
  const url = mangaUrl(r);
  const m = r.pdfMeta;
  const crumbs = [
    ['ホーム', `${S}/`],
    ['作品一覧', `${S}/manga/`],
    ...(r.genres[0] ? [[r.genres[0], genreUrl(r.genres[0])]] : []),
    [r.title, url],
  ];
  const coverAbs = abs(r.images.cover.path);
  const imageLicense = {
    '@type': 'ImageObject',
    '@id': `${url}#cover`,
    url: coverAbs,
    contentUrl: coverAbs,
    width: r.images.cover.width,
    height: r.images.cover.height,
    caption: `${r.title} 表紙`,
    inLanguage: 'ja',
    creator: r.author ? { '@type': 'Person', name: r.author } : { '@id': ORG_ID },
    creditText: r.author || r.imageMeta?.author || config.orgName,
    copyrightNotice: r.imageMeta?.copyright || m.rights || `© ${r.author || '権利者'}`,
    license: `${S}/terms/`,
    acquireLicensePage: `${S}/dmca/`,
    ...(r.imageMeta?.created ? { dateCreated: r.imageMeta.created } : {}),
  };
  const book = {
    '@type': 'Book',
    '@id': `${url}#book`,
    name: r.title,
    ...(r.sourceTitle && r.sourceTitle !== r.title ? { alternateName: r.sourceTitle } : {}),
    url,
    inLanguage: m.language || 'ja',
    bookFormat: 'https://schema.org/EBook',
    numberOfPages: m.pages,
    genre: c.genres,
    keywords: [...new Set([...c.genres, ...m.keywords])].join(', '),
    description: c.answer,
    abstract: c.summary[0],
    image: { '@id': `${url}#cover` },
    isAccessibleForFree: true,
    ...(r.author ? { author: { '@type': 'Person', name: r.author, url: authorUrl(r.author) } } : {}),
    ...(m.created ? { dateCreated: m.created } : {}),
    ...(m.modified ? { dateModified: m.modified } : {}),
    ...(m.publisher ? { publisher: { '@type': 'Organization', name: m.publisher } } : {}),
    ...(m.rights ? { copyrightNotice: m.rights } : {}),
    ...(r.series ? { isPartOf: { '@type': 'BookSeries', name: r.series } } : {}),
    ...(r.volume ? { volumeNumber: String(r.volume) } : {}),
    ...(r.overrides?.sourcePage ? { isBasedOn: r.overrides.sourcePage } : {}),
    ...(r.overrides?.license ? { license: r.overrides.license } : {}),
    encoding: {
      '@type': 'MediaObject',
      contentUrl: r.url,
      encodingFormat: 'application/pdf',
      contentSize: formatBytes(r.file.bytes),
      sha256: r.file.sha256,
      uploadDate: r.file.lastModified || r.addedAt,
    },
    review: {
      '@type': 'Review',
      author: { '@id': JOTARO_ID },
      reviewBody: c.jotaroComment,
      publisher: { '@id': ORG_ID },
    },
  };
  const webpage = {
    '@type': ['WebPage', 'ItemPage'],
    '@id': `${url}#webpage`,
    url,
    name: c.metaTitle,
    description: c.metaDescription,
    inLanguage: 'ja',
    isPartOf: { '@id': SITE_ID },
    about: { '@id': `${url}#book` },
    mainEntity: { '@id': `${url}#book` },
    primaryImageOfPage: { '@id': `${url}#cover` },
    breadcrumb: { '@id': `${url}#breadcrumb` },
    datePublished: r.addedAt,
    dateModified: r.updatedAt,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    reviewedBy: { '@id': JOTARO_ID },
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.answer', '.summary p:first-child'] },
  };
  const faq = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    inLanguage: 'ja',
    mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const relList = {
    '@type': 'ItemList',
    '@id': `${url}#related`,
    name: `『${r.title}』の関連作品`,
    itemListElement: related.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: mangaUrl(x), name: x.title })),
  };

  const metaRows = [
    ['作品名', r.title],
    ['PDFタイトル', m.title],
    ['作者', r.author],
    ['ページ数', `${m.pages}ページ`],
    ['ジャンル', c.genres.join('、')],
    ['PDFキーワード', m.keywords.join('、')],
    ['PDF概要（Subject）', m.subject],
    ['PDF作成日', m.created && jaDate(m.created)],
    ['PDF更新日', m.modified && jaDate(m.modified)],
    ['作成ソフト', m.creator],
    ['PDF変換', m.producer],
    ['PDFバージョン', m.pdfVersion],
    ['ページサイズ', `${m.pageWidthPt} × ${m.pageHeightPt} pt（${m.orientation === 'portrait' ? '縦' : '横'}）`],
    ['ファイルサイズ', formatBytes(r.file.bytes)],
    ['言語', m.language],
    ['権利表記', m.rights],
    ['発行者', m.publisher],
    ['SHA-256', r.file.sha256 && `<code>${r.file.sha256.slice(0, 16)}…</code>`],
    ['表紙画像', r.imageMeta && `${r.imageMeta.width}×${r.imageMeta.height} ${r.imageMeta.format?.toUpperCase() || ''}`],
    ['画像の作者（EXIF/XMP）', r.imageMeta?.author],
    ['画像の著作権（EXIF/IPTC）', r.imageMeta?.copyright],
    ['画像の説明', r.imageMeta?.description],
    ['出典', r.overrides?.sourcePage && `<a href="${esc(r.overrides.sourcePage)}" rel="noopener" target="_blank">${esc(r.overrides.sourceSite || new URL(r.overrides.sourcePage).hostname)}</a>`],
    ['ライセンス', r.overrides?.license],
    ['掲載日', jaDate(r.addedAt)],
    ['最終更新', jaDate(r.updatedAt)],
  ].filter(([, v]) => v);

  const body = `<article class="manga">
  <div class="backdrop" style="--art:url('/${r.images.cover.path}')" aria-hidden="true"></div>
  <header class="manga-head">
    <figure class="cover"><img src="/${r.images.cover.path}" width="${r.images.cover.width}" height="${r.images.cover.height}" alt="${esc(r.title)} 表紙" fetchpriority="high"></figure>
    <div>
      <h1>${esc(r.title)}</h1>
      <p class="byline">${r.author ? `作者：<a href="${authorUrl(r.author).replace(S, '')}">${esc(r.author)}</a> · ` : ''}<span>${m.pages}</span>ページ · PDF ${formatBytes(r.file.bytes)}</p>
      <p class="tags">${c.genres.map((g) => `<a class="tag" href="${genreUrl(g).replace(S, '')}">${esc(g)}</a>`).join('')}</p>
      <p class="answer">${esc(c.answer)}</p>
      <p class="actions"><a class="btn" href="#reader">今すぐ読む</a> <a class="btn ghost" href="${esc(r.url)}" rel="noopener" target="_blank" type="application/pdf">PDFを開く</a></p>
      <p class="muted small">掲載日 <time datetime="${r.addedAt}">${jaDate(r.addedAt)}</time> · 更新 <time datetime="${r.updatedAt}">${jaDate(r.updatedAt)}</time> · 編集：<a href="/about/">${esc(config.orgName)}編集部</a></p>
    </div>
  </header>

  <section class="summary" aria-labelledby="sum-h">
    <h2 id="sum-h">『${esc(r.title)}』とは？あらすじと作品紹介</h2>
    ${c.summary.map((p) => `<p>${esc(p)}</p>`).join('\n    ')}
  </section>

  <section aria-labelledby="hl-h">
    <h2 id="hl-h">『${esc(r.title)}』の見どころ</h2>
    <ul class="checks">${c.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    <h3>こんな人におすすめ</h3>
    <ul class="checks">${c.recommendedFor.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
  </section>

  ${
    r.images.previews.length
      ? `<section aria-labelledby="pv-h"><h2 id="pv-h">試し読みプレビュー</h2><div class="previews">${r.images.previews
          .map((p) => `<figure><img src="/${p.path}" width="${p.width}" height="${p.height}" loading="lazy" decoding="async" alt="${esc(r.title)} ${p.page}ページ目"><figcaption>${p.page}ページ</figcaption></figure>`)
          .join('')}</div></section>`
      : ''
  }

  <section id="reader" class="reader-wrap" aria-labelledby="rd-h">
    <h2 id="rd-h">『${esc(r.title)}』をオンラインで読む</h2>
    <div class="reader" data-pdf="${esc(r.url)}" data-pages="${m.pages}">
      <noscript><p><a href="${esc(r.url)}">PDFを開く</a></p></noscript>
      <button class="btn" type="button" data-reader-start>リーダーを起動（${m.pages}ページ）</button>
    </div>
  </section>

  <section aria-labelledby="md-h">
    <h2 id="md-h">作品情報・PDFメタデータ</h2>
    <table class="meta-table"><tbody>${metaRows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${/^<(code|a) /.test(String(v)) || String(v).startsWith('<code>') ? v : esc(v)}</td></tr>`).join('')}</tbody></table>
    ${m.outline.length ? `<h3>目次（PDFしおり）</h3><ol class="toc">${m.outline.map((o) => `<li>${esc(o)}</li>`).join('')}</ol>` : ''}
  </section>

  <section class="faq" aria-labelledby="faq-h">
    <h2 id="faq-h">『${esc(r.title)}』に関するよくある質問</h2>
    ${c.faq.map((f) => `<details open><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('\n    ')}
  </section>

  <aside class="jotaro-say"><a href="/jotaro/" class="avatar" aria-hidden="true">J</a><div><p class="small muted">${esc(config.curator.name)}のひとこと</p><p>${esc(c.jotaroComment)}</p></div></aside>
</article>

<section aria-labelledby="rel-h">
  <h2 id="rel-h">関連作品</h2>
  ${related.length ? grid(related) : '<p class="muted">関連作品は準備中です。</p>'}
</section>

${jotaroBlock(picks)}

<p class="notice small muted">本ページの作品情報はPDFファイルに記録されたメタデータおよび${esc(config.orgName)}編集部の確認に基づいています。権利者の方で掲載に問題がある場合は<a href="/dmca/">著作権侵害の申し立て</a>からご連絡ください。</p>`;

  return layout({
    title: c.metaTitle,
    description: c.metaDescription,
    path: `/manga/${r.slug}/`,
    body,
    image: r.images.og.path,
    type: 'article',
    crumbs,
    published: r.addedAt,
    modified: r.updatedAt,
    keywords: [r.title, r.author, ...c.genres, '漫画', 'PDF'].filter(Boolean),
    jsonld: [webpage, book, imageLicense, faq, relList, jotaroNode(), ...(picks.length ? [jotaroItemList(picks, url)] : [])],
    extraHead: `<link rel="alternate" type="text/markdown" href="/manga/${r.slug}/index.md" title="Markdown版">\n<link rel="preload" as="image" href="/${r.images.cover.path}">\n`,
  });
}

// ---------- 一覧ページ ----------
export function listPage({ title, h1, intro, path, items, crumbs, pageNum = 1, totalPages = 1, basePath, extraJsonld = [] }) {
  const url = `${S}${path}`;
  const pager =
    totalPages > 1
      ? `<nav class="pager" aria-label="ページ送り">${Array.from({ length: totalPages }, (_, i) => i + 1)
          .map((n) => (n === pageNum ? `<span aria-current="page">${n}</span>` : `<a href="${n === 1 ? basePath : `${basePath}page/${n}/`}">${n}</a>`))
          .join('')}</nav>`
      : '';
  const coll = {
    '@type': 'CollectionPage',
    '@id': `${url}#webpage`,
    url,
    name: h1,
    description: intro,
    inLanguage: 'ja',
    isPartOf: { '@id': SITE_ID },
    breadcrumb: { '@id': `${url}#breadcrumb` },
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: mangaUrl(r), name: r.title })) },
  };
  return layout({
    title: pageNum > 1 ? `${title}（${pageNum}ページ目）` : title,
    description: intro,
    path,
    crumbs,
    jsonld: [coll, ...extraJsonld],
    body: `<h1>${esc(h1)}</h1><p class="lead">${esc(intro)}</p>${items.length ? grid(items) : '<p class="muted">現在、掲載作品はありません。</p>'}${pager}`,
  });
}

// ---------- 静的ページ ----------
export function staticPage({ title, description, path, html, type = 'WebPage', extraJsonld = [] }) {
  const url = `${S}${path}`;
  return layout({
    title,
    description,
    path,
    crumbs: [
      ['ホーム', `${S}/`],
      [title, url],
    ],
    jsonld: [
      { '@type': type, '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'ja', isPartOf: { '@id': SITE_ID }, about: { '@id': ORG_ID }, publisher: { '@id': ORG_ID }, breadcrumb: { '@id': `${url}#breadcrumb` } },
      ...extraJsonld,
    ],
    body: `<article class="prose"><h1>${esc(title)}</h1>${html}</article>`,
  });
}

export { clip };
