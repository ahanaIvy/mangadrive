# MangaDrive — mangadrive.online

A fully automated Japanese manga website. You add PDF URLs and the system does the rest:
it reads each PDF's metadata, renders the cover and preview images, writes Japanese
content, builds SEO and AIO pages, deploys to Cloudflare Workers, and notifies Bing.

## Kaam kaise karta hai (Roman Urdu)

1. `data/sources.txt` mein **har line par ek PDF URL** likhein, phir commit/push karein.
2. GitHub Actions khud chalega (push par, aur har 6 ghante baad):
   - Har PDF download hogi. Usko is tarah parse kiya jayega:
     - **PDF metadata** (Title, Author, Subject, Keywords, CreationDate, Producer, XMP, outline, page size)
     - **Image metadata** (cover URL ka EXIF / IPTC / XMP)
   - Cover aur preview pages ki WebP images banengi. Har image mein **hamara apna metadata** (XMP + EXIF: title, author, MangaDrive credit, page URL) embed hoga.
   - Japanese content generate hoga: summary, AI-overview answer, highlights, FAQ, aur Jotaro ka comment.
   - Website `dist/` mein build hogi, Cloudflare Workers par deploy hogi, aur IndexNow ke zariye Bing/Yandex ko ping jayega.
3. Actions tab → "Build & Deploy MangaDrive" → **Run workflow** se aap URLs directly bhi paste kar sakte hain.

### Optional overrides

```
https://example.com/vol2.pdf | title=桜の剣士 第2巻 | author=山田太郎 | genres=時代劇,アクション | cover=https://example.com/c.jpg
```

## Setup — Cloudflare Workers (one time)

Two parts work together:
- **GitHub Actions** (`.github/workflows/build.yml`) does the heavy work: on push and every 6 hours it downloads the PDFs, extracts metadata, renders images, writes content, and commits the results to `data/`.
- **Cloudflare Workers Builds** (Git integration) deploys on every push to `main`. In Cloudflare (`WORKERS_CI=1`) the build only uses the committed `data/` cache and never re-downloads PDFs.

Steps:
1. Cloudflare → Workers & Pages → connect this repo. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
2. **Custom domain**: add `mangadrive.online` to the same Cloudflare account (Add a domain) and switch your registrar's nameservers to the ones Cloudflare gives you. Wait until the zone shows **Active**. Then go to Workers & Pages → mangadrive → Settings → **Domains & Routes** → Add → Custom domain → `mangadrive.online`. Do the same for `www.mangadrive.online` if you want it.
3. GitHub → Settings → Secrets and variables → Actions:
   - (optional) secret `ANTHROPIC_API_KEY`: AI-written content. Claude reads the cover and preview images plus the metadata and writes the Japanese content.
   - (optional) variables `SOURCES_FEED_URL` (remote TXT/CSV/JSON list of PDF URLs) and `INDEXNOW_KEY`.
4. Submit `https://mangadrive.online/sitemap.xml` to **Google Search Console** and **Bing Webmaster Tools**.

Local preview: `npm run build && npx wrangler dev`

### What the Worker does
- Serves the static site from `dist/`, with cache headers from `public/_headers`.
- `/pdf?u=<pdf-url>` is a PDF proxy so the reader can open PDFs from servers without CORS. It only serves PDFs listed in the site's own catalog, so it is not an open proxy.

## SEO / AIO features

| Feature | Where |
|---|---|
| JSON-LD `@graph`: Organization, WebSite+SearchAction, Book (numberOfPages, encoding PDF MediaObject, sha256), ImageObject (license, creditText, copyrightNotice), FAQPage, BreadcrumbList, Review by Jotaro, ItemList, Speakable | every page |
| Answer-first paragraph (`.answer`), question-style headings, FAQ: built to be quoted in Google AI Overviews, ChatGPT, and Copilot | manga pages |
| `llms.txt`, `llms-full.txt`, a Markdown copy of each page (`/manga/<slug>/index.md`), and `/api/manga.json` | for AI crawlers |
| `robots.txt` explicitly allows GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, and Bingbot | |
| Image sitemap, RSS, canonical, hreflang `ja`, OGP 1200×630, `max-image-preview:large` | |
| IndexNow ping after every deploy (Bing) | `src/indexnow.mjs` |
| Visible metadata table (all PDF and image metadata) | manga pages |

## Auto crawler (no daily work needed)

`src/crawl.mjs` runs every 6 hours, before ingest:
1. Visits every site in `data/crawl.json` (start pages, sitemap.xml, or RSS).
2. Follows links only inside the `allow` domains, up to `maxDepth` / `maxPages`.
3. Obeys each site's **robots.txt** and Crawl-delay, and identifies itself as `MangaDriveBot`.
4. For every PDF link it saves the page's **title** (og:title / `<title>` / link text), **description** (og:description / meta description), **featured image** (og:image or the thumbnail beside the link), author, and keywords. The source page is credited on the manga page (出典) and in JSON-LD `isBasedOn`.
5. New PDFs go into `data/crawled.json` (max `maxNewPerRun` per run), and then the normal pipeline makes the full SEO page.

Add a site:
```json
{ "name": "Site name", "start": ["https://site.example/manga/"], "allow": ["site.example"],
  "follow": "/manga/", "genres": ["少年漫画"], "license": "CC BY 4.0" }
```
Only add sites whose content you have the right to republish: your own, creators who agreed, or public-domain / Creative Commons sources.

## Jotaro

Jotaro is MangaDrive's chief manga curator. A "Jotaro's picks" list appears under the **related works** on every post.
- **Automatic**: Jotaro picks from the site's own works (comment generated by AI or the template).
- **Manual**: add good manga found online to `data/jotaro.json` (format in `data/jotaro.example.json`).
- Profile and full list: `/jotaro/`

## Pages

About (運営者情報), Contact (お問い合わせ), Terms (利用規約), Privacy (プライバシーポリシー), DMCA (著作権侵害の申し立て), Editorial policy (編集方針), Jotaro, genre pages, author pages, search, and 404.

## DMCA takedown

Add the PDF URL or slug to `data/blocklist.txt` and push. The next build permanently deletes that page, its images, and its cache, and the URL is never ingested again.

## Commands

```bash
npm install
npm run build        # ingest new PDFs and build the site
npm run refresh      # re-download every PDF
npm run regen        # regenerate all content (e.g. after adding an API key)
npx wrangler dev     # preview the Worker + site locally
```

Settings (name, emails, Jotaro bio, AI model, etc.) are in `site.config.mjs`.
