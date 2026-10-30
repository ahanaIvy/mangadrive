// 組織ページ（運営者情報・お問い合わせ・利用規約・プライバシー・DMCA・編集方針）
import config from '../site.config.mjs';
import { esc, jaDate } from './util.mjs';
import { staticPage, jotaroNode, jotaroBlock, jotaroItemList, grid } from './render.mjs';

const O = esc(config.orgName);
const D = esc(config.domain);
const updated = jaDate(new Date());

export function aboutPage(stats) {
  return staticPage({
    title: '運営者情報（MangaDriveについて）',
    description: `${config.orgName}（${config.orgNameJa}）の運営者情報。組織概要、ミッション、編集体制、運営方針、連絡先を掲載しています。`,
    path: '/about/',
    type: 'AboutPage',
    html: `
<p class="answer">${O}（${esc(config.orgNameJa)}）は、インターネット上でPDF形式により公開されている漫画作品を収集・整理し、作品情報・メタデータ・あらすじとともに日本語で紹介する漫画ライブラリの運営組織です。公式サイトは <a href="/">${D}</a> です。</p>

<h2>組織概要</h2>
<table class="meta-table"><tbody>
<tr><th scope="row">組織名</th><td>${O}（${esc(config.orgNameJa)}）</td></tr>
<tr><th scope="row">公式サイト</th><td>https://${D}/</td></tr>
<tr><th scope="row">設立</th><td>${jaDate(config.foundingDate)}</td></tr>
<tr><th scope="row">事業内容</th><td>漫画作品（PDF）の情報整理・紹介、作品データベースの運営、漫画キュレーション</td></tr>
<tr><th scope="row">掲載作品数</th><td>${stats.count}作品（${updated}時点）</td></tr>
<tr><th scope="row">対応言語</th><td>日本語</td></tr>
<tr><th scope="row">お問い合わせ</th><td><a href="/contact/">お問い合わせページ</a> / ${esc(config.email.contact)}</td></tr>
<tr><th scope="row">著作権窓口</th><td><a href="/dmca/">DMCA・著作権侵害の申し立て</a> / ${esc(config.email.dmca)}</td></tr>
</tbody></table>

<h2>ミッション</h2>
<p>${O}のミッションは、「読みたい漫画に、最短でたどり着ける場所をつくる」ことです。ネット上には数多くの漫画PDFが公開されていますが、タイトルや作者、ページ数といった基本情報が整理されていないため、読者が良い作品を見つけるのは簡単ではありません。私たちはPDFに記録されたメタデータを読み取り、作品ごとに分かりやすい紹介ページを作成することで、作品と読者をつなぎます。</p>

<h2>${O}が提供するもの</h2>
<ul class="checks">
<li><strong>作品データベース</strong>：タイトル・作者・ページ数・ジャンル・作成日などのPDFメタデータを整理して公開</li>
<li><strong>作品紹介</strong>：あらすじ、見どころ、よくある質問を日本語でまとめた作品ページ</li>
<li><strong>ブラウザリーダー</strong>：アプリ不要でPDFをそのまま閲覧できるオンラインリーダー</li>
<li><strong>キュレーション</strong>：チーフ・マンガキュレーターの<a href="/jotaro/">${esc(config.curator.name)}</a>による厳選リスト</li>
</ul>

<h2>編集体制</h2>
<p>${O}編集部は、作品データの収集・確認を行うデータチームと、作品紹介を担当する編集チーム、そしてキュレーションを担当する${esc(config.curator.name)}で構成されています。作品ページは自動化されたデータ処理と編集部の確認を組み合わせて作成されます。詳しくは<a href="/editorial-policy/">編集方針</a>をご覧ください。</p>

<h2>著作権について</h2>
<p>${O}は著作権者の権利を尊重します。掲載作品に関して権利上の問題がある場合は、<a href="/dmca/">著作権侵害の申し立てページ</a>からご連絡ください。受付後、原則として2営業日以内に確認し、該当コンテンツを削除・非表示にします。</p>

<p class="small muted">最終更新：${updated}</p>`,
  });
}

export function contactPage() {
  return staticPage({
    title: 'お問い合わせ',
    description: `${config.orgName}へのお問い合わせ窓口。作品掲載・削除依頼、取材・提携、サイトの不具合などはこちらからご連絡ください。`,
    path: '/contact/',
    type: 'ContactPage',
    html: `
<p class="answer">${O}へのお問い合わせは、下記メールアドレスまたはフォームから受け付けています。通常、2営業日以内に担当者よりご返信します。</p>
<h2>お問い合わせ窓口</h2>
<table class="meta-table"><tbody>
<tr><th scope="row">一般のお問い合わせ</th><td><a href="mailto:${esc(config.email.contact)}">${esc(config.email.contact)}</a></td></tr>
<tr><th scope="row">著作権・削除依頼</th><td><a href="mailto:${esc(config.email.dmca)}">${esc(config.email.dmca)}</a>（<a href="/dmca/">詳細</a>）</td></tr>
<tr><th scope="row">個人情報の取扱い</th><td><a href="mailto:${esc(config.email.privacy)}">${esc(config.email.privacy)}</a></td></tr>
</tbody></table>

<h2>お問い合わせフォーム</h2>
<form class="contact-form" action="mailto:${esc(config.email.contact)}" method="post" enctype="text/plain">
  <label>お名前<input name="name" required autocomplete="name"></label>
  <label>メールアドレス<input type="email" name="email" required autocomplete="email"></label>
  <label>種別<select name="type"><option>作品について</option><option>掲載のご依頼</option><option>削除・著作権</option><option>取材・提携</option><option>不具合の報告</option><option>その他</option></select></label>
  <label>内容<textarea name="message" rows="6" required></textarea></label>
  <button class="btn" type="submit">送信する</button>
</form>
<p class="small muted">送信いただいた情報は<a href="/privacy/">プライバシーポリシー</a>に従って取り扱います。</p>`,
  });
}

export function termsPage() {
  return staticPage({
    title: '利用規約',
    description: `${config.orgName}（${config.domain}）の利用規約。サービスの内容、禁止事項、免責事項、知的財産権について定めています。`,
    path: '/terms/',
    html: `
<p>この利用規約（以下「本規約」）は、${O}（以下「当組織」）が運営するウェブサイト「${D}」（以下「本サービス」）の利用条件を定めるものです。利用者は本サービスを利用することにより、本規約に同意したものとみなされます。</p>
<h2>第1条（サービスの内容）</h2>
<p>本サービスは、インターネット上でPDF形式により公開されている漫画作品について、作品情報・メタデータ・紹介文を整理して提供する情報サービスです。作品のPDFファイルは、原則として公開元のURLを参照して表示されます。</p>
<h2>第2条（知的財産権）</h2>
<p>掲載作品の著作権は、各作品の著作者または正当な権利者に帰属します。本サービス上の紹介文、データベース構成、デザイン、ロゴ等の著作権は当組織に帰属します。</p>
<h2>第3条（禁止事項）</h2>
<ul>
<li>法令または公序良俗に違反する行為</li>
<li>著作権その他第三者の権利を侵害する行為</li>
<li>本サービスのコンテンツを無断で転載・再配布・商用利用する行為</li>
<li>本サービスのサーバーに過度な負荷をかける行為、不正アクセス</li>
<li>その他、当組織が不適切と判断する行為</li>
</ul>
<h2>第4条（権利侵害への対応）</h2>
<p>当組織は権利者からの申し立てを受けた場合、<a href="/dmca/">著作権ポリシー</a>に従い、速やかに該当コンテンツを削除または非表示にします。</p>
<h2>第5条（免責事項）</h2>
<p>当組織は、掲載情報の正確性・完全性について可能な限り確認しますが、その内容を保証するものではありません。外部サイトのPDFファイルやリンク先の内容について、当組織は責任を負いません。本サービスの利用により生じた損害について、当組織に故意または重過失がある場合を除き、責任を負いません。</p>
<h2>第6条（サービスの変更・停止）</h2>
<p>当組織は、事前の通知なく本サービスの内容を変更し、または提供を停止することがあります。</p>
<h2>第7条（規約の変更）</h2>
<p>当組織は必要に応じて本規約を変更できるものとします。変更後の規約は本ページに掲載した時点で効力を生じます。</p>
<h2>第8条（準拠法・管轄）</h2>
<p>本規約の解釈には日本法を準拠法とします。</p>
<p class="small muted">制定日：${jaDate(config.foundingDate)}／最終更新：${updated}</p>`,
  });
}

export function privacyPage() {
  return staticPage({
    title: 'プライバシーポリシー',
    description: `${config.orgName}における個人情報の取扱い、アクセス解析、Cookieの利用についての方針。`,
    path: '/privacy/',
    html: `
<p>${O}（以下「当組織」）は、利用者の個人情報を適切に保護することを社会的責務と考え、以下の方針に基づき個人情報を取り扱います。</p>
<h2>1. 取得する情報</h2>
<p>お問い合わせの際にご提供いただく氏名・メールアドレス・お問い合わせ内容、ならびにアクセスログ（IPアドレス、ブラウザの種類、閲覧ページ、日時）を取得することがあります。</p>
<h2>2. 利用目的</h2>
<ul><li>お問い合わせへの回答</li><li>著作権侵害の申し立てへの対応</li><li>サービスの改善および不正利用の防止</li></ul>
<h2>3. 第三者提供</h2>
<p>法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供することはありません。</p>
<h2>4. Cookie・アクセス解析</h2>
<p>本サービスでは利便性向上のため、ブラウザのローカルストレージ等を利用する場合があります。これらはブラウザの設定で無効にできます。</p>
<h2>5. 開示・訂正・削除</h2>
<p>ご本人から個人情報の開示・訂正・削除の請求があった場合、本人確認のうえ速やかに対応します。窓口：<a href="mailto:${esc(config.email.privacy)}">${esc(config.email.privacy)}</a></p>
<h2>6. 改定</h2>
<p>本ポリシーは必要に応じて改定し、本ページで公表します。</p>
<p class="small muted">最終更新：${updated}</p>`,
  });
}

export function dmcaPage() {
  return staticPage({
    title: 'DMCA・著作権侵害の申し立て',
    description: `${config.orgName}の著作権ポリシーとDMCA（デジタルミレニアム著作権法）に基づく削除申し立ての手順。権利者の方はこちらからご連絡ください。`,
    path: '/dmca/',
    html: `
<p class="answer">${O}は著作権者の権利を尊重し、DMCA（米国デジタルミレニアム著作権法）および日本のプロバイダ責任制限法の趣旨に沿って、権利侵害の申し立てに迅速に対応します。申し立ては <a href="mailto:${esc(config.email.dmca)}">${esc(config.email.dmca)}</a> で受け付けています。</p>
<h2>申し立てに必要な情報</h2>
<ol>
<li>権利者（または代理人）の氏名・連絡先（住所、電話番号、メールアドレス）</li>
<li>侵害されたと主張する著作物の特定（作品名、権利を証明する情報）</li>
<li>${O}上の該当ページのURL（例：https://${D}/manga/○○/）</li>
<li>「当該利用は権利者、その代理人または法律により許諾されていない」と誠実に信じる旨の記載</li>
<li>「通知の内容は正確であり、偽証した場合は罰せられることを理解している」旨の記載</li>
<li>署名（電子署名可）</li>
</ol>
<h2>対応の流れ</h2>
<ol>
<li>申し立てを受領後、原則として<strong>2営業日以内</strong>に内容を確認します。</li>
<li>要件を満たす申し立てについては、該当ページ・画像・PDFへの参照を削除し、以降の自動取り込みからも除外します（ブロックリストへの登録）。</li>
<li>対応完了後、申立人にメールでご報告します。</li>
</ol>
<h2>異議申し立て（カウンター通知）</h2>
<p>削除されたコンテンツの掲載者が正当な権利を有すると考える場合、上記と同様の情報を記載のうえ異議申し立てを行うことができます。</p>
<h2>English</h2>
<p>To submit a DMCA takedown notice, email <a href="mailto:${esc(config.email.dmca)}">${esc(config.email.dmca)}</a> with the information listed above. We respond within 2 business days.</p>
<p class="small muted">最終更新：${updated}</p>`,
  });
}

export function editorialPage() {
  return staticPage({
    title: '編集方針',
    description: `${config.orgName}の編集方針。作品情報の収集方法、メタデータの扱い、紹介文の作成プロセス、訂正ポリシーについて説明します。`,
    path: '/editorial-policy/',
    html: `
<p class="answer">${O}の作品ページは、PDFファイルに記録されたメタデータの自動解析と、${O}編集部の確認を組み合わせて作成しています。確認できない情報は掲載せず、誤りが判明した場合は速やかに訂正します。</p>
<h2>1. 情報の収集</h2>
<p>作品ごとにPDFファイルを解析し、タイトル、作者、キーワード、作成日、ページ数、ページサイズ、目次（しおり）などのメタデータを抽出します。表紙画像に含まれるEXIF・IPTC・XMP情報も参照します。</p>
<h2>2. 紹介文の作成</h2>
<p>紹介文・見どころ・よくある質問は、抽出したメタデータと表紙・冒頭ページの内容に基づいて作成します。受賞歴や発行部数など、資料から確認できない事実は記載しません。作成過程ではAIによる文章生成を補助的に利用する場合があります。</p>
<h2>3. キュレーション</h2>
<p>チーフ・マンガキュレーターの<a href="/jotaro/">${esc(config.curator.name)}</a>が、ストーリー・作画・読みやすさの観点から作品を選定し、おすすめリストとして公開しています。</p>
<h2>4. 訂正ポリシー</h2>
<p>掲載内容の誤りについては<a href="/contact/">お問い合わせ</a>からご指摘ください。確認後、該当ページを訂正し、更新日を明記します。</p>
<h2>5. 独立性</h2>
<p>作品の紹介順位や評価は、広告や金銭的な関係によって左右されません。</p>
<p class="small muted">最終更新：${updated}</p>`,
  });
}

export function jotaroPage(picks, internalPicks) {
  const url = `${config.siteUrl}/jotaro/`;
  return staticPage({
    title: `${config.curator.name}のおすすめ漫画リスト`,
    description: `${config.orgName}のチーフ・マンガキュレーター${config.curator.name}が、ネットで見つけた本当に面白い漫画を厳選して公開しているおすすめリストです。`,
    path: '/jotaro/',
    type: 'ProfilePage',
    extraJsonld: [{ ...jotaroNode() }, jotaroItemList([...picks, ...internalPicks], url), { '@type': 'ProfilePage', '@id': `${url}#webpage`, mainEntity: { '@id': `${config.siteUrl}/jotaro/#person` } }],
    html: `
<div class="jotaro-say big"><span class="avatar" aria-hidden="true">J</span><div><p><strong>${esc(config.curator.name)}</strong>（${esc(config.curator.role)}）</p><p>${esc(config.curator.bio)}</p></div></div>
<p class="answer">${esc(config.curator.name)}は、${O}でおすすめ漫画の選定を担当するキュレーターです。インターネット上で公開されている作品を毎日チェックし、ストーリー・作画・読みやすさの3つの基準で選んだ作品をこのページで公開しています。</p>
<h2>選定基準</h2>
<ul class="checks"><li>最初の数ページで引き込まれるストーリーか</li><li>作画・コマ割りが読みやすいか</li><li>読み終わったあとに誰かに勧めたくなるか</li></ul>
${internalPicks.length ? `<h2>${O}で読めるおすすめ作品</h2>${jotaroBlock(internalPicks, { heading: `${config.curator.name}が選ぶ ${config.orgName} 掲載作品` })}` : ''}
${picks.length ? `<h2>ネットで見つけたおすすめ漫画</h2>${jotaroBlock(picks, { heading: `${config.curator.name}の公開リスト` })}` : ''}`,
  });
}

export { grid };
