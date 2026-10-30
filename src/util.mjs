import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const DATA = path.join(ROOT, 'data');
export const CACHE = path.join(DATA, 'cache');
export const MEDIA = path.join(DATA, 'media');
export const DIST = path.join(ROOT, 'dist');

export const sha = (s, n = 10) => createHash('sha256').update(String(s)).digest('hex').slice(0, n);

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const clip = (s = '', n = 120) => {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

// ASCII 部分があれば英数字スラッグ、なければハッシュ ID
export function makeSlug(title, url) {
  const ascii = String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const id = sha(url, ascii.length >= 3 ? 6 : 8);
  return ascii.length >= 3 ? `${ascii}-${id}` : `m-${id}`;
}

// 日本語タグ用スラッグ（URL エンコード前提で日本語を残す）
export const tagSlug = (s) =>
  String(s).normalize('NFKC').trim().toLowerCase().replace(/[\s/\\?#%&]+/g, '-').replace(/^-+|-+$/g, '');

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

export const isoDate = (d) => {
  const t = d ? new Date(d) : new Date();
  return isNaN(t) ? new Date().toISOString() : t.toISOString();
};

export const jaDate = (d) => {
  const t = new Date(d);
  return `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日`;
};

export const formatBytes = (n) => {
  if (!n) return '不明';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) (n /= 1024), i++;
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
};

export const uniq = (a) => [...new Set(a.filter(Boolean))];
