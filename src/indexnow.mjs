// デプロイ後に実行：sitemap の変更 URL を IndexNow（Bing / Yandex / Naver / Seznam）に通知
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../site.config.mjs';
import { ROOT, DIST, readJson, writeFile } from './util.mjs';

const xml = await fs.readFile(path.join(DIST, 'sitemap.xml'), 'utf8');
const entries = [...xml.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1].replace(/&amp;/g, '&'), m[2]]);
const stateFile = path.join(ROOT, 'data', 'indexnow-sent.json');
const prev = await readJson(stateFile, {});
// 静的ページは lastmod がビルド毎に変わるため、初回のみ送信
const changed = entries.filter(([u, lm]) => !(u in prev) || (prev[u] !== lm && /\/manga\//.test(u))).map(([u]) => u);

if (!changed.length) {
  console.log('IndexNow: 変更なし');
} else {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: config.domain, key: config.indexNowKey, keyLocation: `${config.siteUrl}/${config.indexNowKey}.txt`, urlList: changed.slice(0, 10000) }),
  });
  console.log(`IndexNow: ${changed.length}件送信 → HTTP ${res.status}`);
  if (res.ok) await writeFile(stateFile, JSON.stringify(Object.fromEntries(entries), null, 1));
  else process.exitCode = 0; // 通知失敗でデプロイを止めない
}
