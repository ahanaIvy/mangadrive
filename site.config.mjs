// MangaDrive サイト設定 — ここだけ編集すればサイト全体に反映されます。
export default {
  orgName: 'MangaDrive',
  orgNameJa: 'マンガドライブ',
  domain: 'mangadrive.online',
  siteUrl: 'https://mangadrive.online',
  lang: 'ja',
  locale: 'ja_JP',
  tagline: 'PDFで読める漫画のデジタルライブラリ',
  description:
    'MangaDrive（マンガドライブ）は、PDF形式で公開されている漫画作品を整理・分類し、作品情報・メタデータ・あらすじとともに紹介する日本語の漫画ライブラリ運営組織です。',
  foundingDate: '2026-01-01',
  email: {
    contact: 'contact@mangadrive.online',
    dmca: 'dmca@mangadrive.online',
    privacy: 'privacy@mangadrive.online',
  },
  // SNS 等（あれば追加。sameAs として構造化データに出力）
  sameAs: [],

  // 「Jotaro」— ネットで良い漫画を探して公開リストにするキュレーター
  curator: {
    name: 'Jotaro',
    slug: 'jotaro',
    role: 'チーフ・マンガキュレーター',
    bio: 'Jotaroは MangaDrive のチーフ・マンガキュレーターです。インターネット上に公開されている数多くの漫画を毎日読み込み、本当に面白い作品だけを選び抜いて公開リストとして紹介しています。',
  },

  // 自動化
  maxPdfBytes: 200 * 1024 * 1024, // これより大きい PDF は取り込まない
  previewPages: 4, // 生成するプレビュー画像の枚数
  relatedCount: 6,
  jotaroPicksPerPost: 5,
  postsPerPage: 24,

  // AI 生成（ANTHROPIC_API_KEY があれば使用。なければテンプレート生成）
  ai: {
    model: 'claude-opus-5-5',
    effort: 'medium',
  },

  // IndexNow（Bing / Yandex / Seznam / Naver に即時通知）。環境変数 INDEXNOW_KEY があればそちらを優先
  indexNowKey: process.env.INDEXNOW_KEY || 'f3a9c2e1b7d64e0a9c5b1d2e3f4a5b6c',
};
