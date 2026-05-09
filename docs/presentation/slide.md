---
marp: true
paginate: true
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');

:root {
  --accent: #e8622a;
  --accent2: #ee15a6;
  --bg: #fff8f5;
  --surface: #ffffff;
  --border: rgba(232, 98, 42, 0.15);
  --text: #1e293b;
  --muted: #94a3b8;
}

section {
  background-color: var(--bg);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  padding: 60px 72px;
  position: relative;
  overflow: hidden;
}

/* グリッド背景 */
section::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(232,98,42,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(232,98,42,0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
}

/* アクセントライン（左） */
section::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, #eb5e28, #ee15a6);
}

/* ページ番号 */
section.paginate p.paginate {
  color: var(--muted);
  font-size: 13px;
}

h1 {
  font-family: 'Syne', sans-serif;
  font-size: 52px;
  font-weight: 800;
  line-height: 1.1;
  color: #fff;
  margin: 0 0 16px;
}

h2 {
  font-family: 'Syne', sans-serif;
  font-size: 36px;
  font-weight: 700;
  color: var(--accent);
  margin: 0 0 32px;
  letter-spacing: -0.5px;
}

h3 {
  font-size: 18px;
  font-weight: 500;
  color: var(--accent);
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

p {
  font-size: 18px;
  line-height: 1.7;
  color: var(--text);
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

ul li {
  font-size: 18px;
  line-height: 1.6;
  padding: 10px 0 10px 24px;
  border-bottom: 1px solid var(--border);
  position: relative;
  color: var(--text);
}

ul li::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: var(--accent);
}

.tag {
  display: inline-block;
  background: rgba(232,98,42,0.08);
  border: 1px solid var(--border);
  color: var(--accent);
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 4px;
  margin: 4px 4px 4px 0;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px 28px;
  margin-bottom: 16px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.highlight {
  color: var(--accent2);
  font-weight: 600;
}

/* タイトルスライド */
section.title {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

section.title h1 {
  font-size: 64px;
  background: linear-gradient(135deg, #eb5e28 30%, #ee15a6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

section.title .subtitle {
  font-size: 20px;
  color: var(--muted);
  margin-top: 12px;
}

section.title .team {
  margin-top: 48px;
  font-size: 15px;
  color: var(--muted);
}
</style>

<!-- _class: title -->
<!-- _paginate: false -->

# 茅場ブロードウェイ

<p class="subtitle">〜 決済 × リアルタイム通信 × 仮想空間 で作るオンラインコミケ 〜</p>

<div class="team">
Study Basic Hackathon ／ 2026
</div>

---

## コンセプト

<p><span class="highlight">決済・WebSocket・WebRTC</span> の3技術を活かせるアプリとして、オンラインコミケに行き着いた。</p>

<div class="card">
<h3>着想</h3>
<p>「決済」「リアルタイム同期」「通話」を全部使い切れるユースケースは何か？　→　同人誌を買いながら、他の参加者と同じ空間にいられる<strong>バーチャルコミケ</strong>だった。</p>
</div>

<div class="card">
<h3>コンセプト</h3>
<p>中野ブロードウェイをモデルに、2Dマップを歩き回りながら商品を購入・他ユーザーとリアルタイムで交流できる仮想商店街<strong>「茅場ブロードウェイ」</strong>を開発。</p>
</div>

---

## アーキテクチャ

<div class="grid-2">
<div>
<div class="card">
<h3>フロントエンド</h3>
<ul>
<li>Angular（SPA フレームワーク）</li>
<li>PixiJS（2D マップ描画）</li>
<li>Cloudflare Pages（ホスティング）</li>
</ul>
</div>
<div class="card">
<h3>バックエンド</h3>
<ul>
<li>Hono + Drizzle ORM（REST API）</li>
<li>Cloudflare Workers（サーバーレス）</li>
<li>Partykit（WebSocket リアルタイム通信）</li>
<li>Cloudflare D1 / R2（DB・ストレージ）</li>
</ul>
</div>
</div>
<div>
<div class="card" style="height: 100%; box-sizing: border-box;">
<h3>構成図</h3>
<p style="color: var(--muted); font-size: 14px; margin-bottom: 12px;">ブラウザ → Workers → D1 / R2<br>ブラウザ → Partykit（WebSocket）</p>
<span class="tag">Angular</span>
<span class="tag">PixiJS</span>
<span class="tag">Hono</span>
<span class="tag">Partykit</span>
<span class="tag">D1</span>
<span class="tag">R2</span>
<span class="tag">Workers</span>
</div>
</div>
</div>

---

## 取り組んだこと

<ul>
<li><strong>PixiJS による 2D マップ実装</strong>　ポケモン式のキャラクター移動・フィールド描画をキャンバス上で実現</li>
<li><strong>Partykit による リアルタイム同期</strong>　WebSocket で他ユーザーのキャラクター位置をリアルタイム表示</li>
<li><strong>購入・ダウンロードフロー</strong>　商品ポップアップ → モック決済 → デジタルファイルのダウンロードまで一貫して実装</li>
<li><strong>フルサーバーレス構成</strong>　Cloudflare Workers / D1 / R2 / Pages を組み合わせたインフラ構築</li>
</ul>

---

## 課題

<div class="grid-2">
<div class="card">
<h3>現状の課題</h3>
<ul>
<li>決済がモック実装（Stripe 未統合）</li>
<li>出店者側の管理機能が未実装</li>
<li>アバターのカスタマイズ非対応</li>
</ul>
</div>
<div class="card">
<h3>今後の展望</h3>
<ul>
<li>Stripe による本番決済の統合</li>
<li>出店者向け商品管理・売上管理機能</li>
<li>複数フィールド・複数店舗への拡張</li>
<li>ライブスペース（WebRTC イベント配信）</li>
</ul>
</div>
</div>

---

<!-- _paginate: false -->
<!-- _class: title -->

# ご清聴ありがとうございました

<p class="subtitle">Demo & Q&A</p>