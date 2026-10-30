// 作品ページの日本語コンテンツ生成
// ANTHROPIC_API_KEY があれば Claude（表紙・プレビュー画像＋メタデータを読ませる）、なければテンプレートで生成
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import config from '../site.config.mjs';
import { DATA, clip, formatBytes, jaDate, uniq } from './util.mjs';

const ContentSchema = z.object({
  metaTitle: z.string().describe('検索結果用タイトル。32文字以内。作品名を先頭に'),
  metaDescription: z.string().describe('メタディスクリプション。80〜120文字'),
  answer: z.string().describe('「〇〇とは？」に1段落（100〜160文字）で直接答える要約。AI検索の回答に引用されやすい断定的な文'),
  summary: z.array(z.string()).describe('作品紹介の段落 2〜3 個。各 120〜250 文字'),
  highlights: z.array(z.string()).describe('見どころ 3〜5 個。各 1 文'),
  recommendedFor: z.array(z.string()).describe('こんな人におすすめ 3 個'),
  genres: z.array(z.string()).describe('日本語のジャンルタグ 2〜6 個'),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).describe('よくある質問 4〜6 個。回答は 1〜3 文'),
  jotaroComment: z.string().describe('キュレーター Jotaro の一言レビュー（60〜120文字、一人称「俺」）'),
});

function facts(rec) {
  const m = rec.pdfMeta;
  return {
    作品名: rec.title,
    作者: rec.author || '不明',
    ページ数: m.pages,
    ジャンル: rec.genres.join('、') || '未分類',
    概要_PDF内: m.subject || '',
    キーワード_PDF内: m.keywords.join('、'),
    作成日_PDF内: m.created ? jaDate(m.created) : '不明',
    ファイルサイズ: formatBytes(rec.file.bytes),
    ページ向き: m.orientation === 'portrait' ? '縦' : '横',
    目次: m.outline.slice(0, 20).join(' / '),
    画像メタデータ: rec.imageMeta ? JSON.stringify(rec.imageMeta) : '',
    抽出テキスト冒頭: clip(rec.textExcerpt, 1500),
    運営側メモ: rec.overrides?.description || '',
    出典ページ: rec.overrides?.sourcePage || '',
  };
}

// ---------- テンプレート生成 ----------
export function templateContent(rec) {
  const m = rec.pdfMeta;
  const t = rec.title;
  const by = rec.author ? `${rec.author}による` : '';
  const g = rec.genres.length ? rec.genres.slice(0, 3).join('・') : '漫画';
  const sub = rec.overrides?.description || m.subject;
  const created = m.created ? jaDate(m.created) : null;
  const answer = `『${t}』は、${by}全${m.pages}ページの${g}作品です。MangaDrive ではPDF形式（${formatBytes(rec.file.bytes)}）で公開されている本作を、作品情報・メタデータ・プレビュー画像とともに紹介しています。${sub ? clip(sub, 60) : ''}`;
  return {
    metaTitle:
      [`${t}${rec.author ? `（${rec.author}）` : ''} PDF・あらすじ・作品情報`, `${t} PDF・あらすじ・作品情報`, `${t}のあらすじ・作品情報`, `${t} PDF`].find((x) => x.length <= 36) || clip(t, 36),
    metaDescription: clip(`『${t}』${rec.author ? `（${rec.author}）` : ''}は全${m.pages}ページの${g}漫画。${sub ? clip(sub, 50) + '。' : ''}あらすじ、見どころ、PDF情報、よくある質問をMangaDriveがまとめて紹介します。`, 120),
    answer,
    summary: [
      `『${t}』は${by}描かれた${g}の漫画作品で、PDF形式で全${m.pages}ページにまとめられています。${sub ? sub + '。' : ''}${created ? `PDFの作成日は${created}と記録されています。` : ''}`,
      `本作は${m.orientation === 'portrait' ? '縦長' : '横長'}のページ構成で、スマートフォンでもパソコンでも読みやすいレイアウトです。MangaDrive の編集部は、PDFに含まれるメタデータ（タイトル・作者・キーワード・作成日など）を確認し、作品情報として整理しています。`,
      `${rec.genres.length ? `ジャンルは「${rec.genres.join('」「')}」に分類されます。` : ''}同じジャンルの作品は関連作品の欄やタグページからまとめて探すことができます。`,
    ].filter((p) => p.trim()),
    highlights: uniq([
      `全${m.pages}ページを一気に読めるボリューム`,
      rec.genres[0] ? `${rec.genres[0]}ファンに刺さる展開` : 'テンポの良いストーリー展開',
      rec.author ? `${rec.author}ならではの作風` : '個性的なキャラクターと作画',
      'ブラウザ上でそのまま読めるPDF形式',
    ]),
    recommendedFor: [`${g}が好きな人`, '短時間で読める漫画を探している人', 'PDFでまとめて漫画を読みたい人'],
    genres: rec.genres.length ? rec.genres.slice(0, 6) : ['漫画'],
    faq: [
      { q: `『${t}』の作者は誰ですか？`, a: rec.author ? `『${t}』の作者は${rec.author}です。` : `PDFのメタデータに作者情報は記録されていません。判明し次第、MangaDriveで追記します。` },
      { q: `『${t}』は何ページありますか？`, a: `全${m.pages}ページです（PDFファイルサイズは${formatBytes(rec.file.bytes)}）。` },
      { q: `『${t}』はどんなジャンルの漫画ですか？`, a: `${g}に分類される作品です。` },
      { q: `『${t}』はどこで読めますか？`, a: `MangaDriveの作品ページにあるPDFリーダーからブラウザで閲覧できます。元のPDFファイルへのリンクも掲載しています。` },
      { q: '掲載内容に問題がある場合はどうすればよいですか？', a: '権利者の方は DMCA・著作権侵害申し立てページからご連絡ください。確認後、速やかに対応します。' },
    ],
    jotaroComment: `${g}好きなら一度は目を通してほしい一冊だ。全${m.pages}ページ、サクッと読めるのに印象に残る。俺のリストにも入れておいた。`,
  };
}

// ---------- Claude による生成 ----------
async function imageBlock(rel) {
  try {
    const data = await fs.readFile(path.join(DATA, rel));
    return { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: data.toString('base64') } };
  } catch {
    return null;
  }
}

async function aiContent(rec) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod');
  const client = new Anthropic();
  const imgs = (await Promise.all([rec.images?.cover?.path, ...(rec.images?.previews || []).slice(0, 3).map((p) => p.path)].filter(Boolean).map(imageBlock))).filter(Boolean);

  const system = `あなたは日本の漫画紹介メディア「${config.orgName}」（${config.domain}）の編集者です。
作品ページの本文を日本語で書きます。読者・Google検索・AI検索（Google AI Overview、ChatGPT、Bing Copilot）に引用されやすいよう、
・最初に結論を述べる、事実を具体的に（ページ数・作者・ジャンル）書く、
・画像とメタデータから確認できる事実だけを書き、確認できないこと（受賞歴・発行部数・続巻など）は書かない、
・誇張表現、絵文字、英語の混在を避け、自然な日本語で書く。
Jotaro は ${config.orgName} のキュレーターで、ネットで良い漫画を見つけて公開リストにしている人物です。`;

  const resp = await client.beta.messages.parse({
    model: config.ai.model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: config.ai.effort, format: betaZodOutputFormat(ContentSchema) },
    system,
    messages: [
      {
        role: 'user',
        content: [
          ...imgs,
          { type: 'text', text: `以下は作品のPDFから抽出したメタデータと、表紙・冒頭ページの画像です。作品ページ用のコンテンツを作成してください。\n\n${JSON.stringify(facts(rec), null, 2)}` },
        ],
      },
    ],
  });
  if (resp.stop_reason === 'refusal' || !resp.parsed_output) throw new Error(`AI生成不可 (${resp.stop_reason})`);
  return resp.parsed_output;
}

export async function generateContent(rec) {
  if (process.env.ANTHROPIC_API_KEY && process.env.AI_CONTENT !== 'off') {
    try {
      const c = await aiContent(rec);
      return { ...c, generatedBy: 'ai', generatedAt: new Date().toISOString() };
    } catch (e) {
      console.warn(`  AI生成失敗、テンプレートを使用: ${e.message}`);
    }
  }
  return { ...templateContent(rec), generatedBy: 'template', generatedAt: new Date().toISOString() };
}
