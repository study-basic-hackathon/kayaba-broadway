# Copilot Instructions

## プロジェクト概要

**茅場ブロードウェイ** は、仮想空間（2Dマップ）を自由に歩き回りながら、デジタルコンテンツ（PDF同人誌等）を購入できるオンラインマーケットサービス。

## ドキュメント一覧

| ファイル | 説明 |
|----------|------|
| [docs/design-doc.md](../docs/design-doc.md) | Design Doc。コンセプト・機能要件・画面構成・システム構成・DB/API初期設計をまとめたメインドキュメント |

## リポジトリ構成

バックエンド（Cloudflare Workers / Hono）がルートに、フロントエンド（Angular）が `frontend/` サブディレクトリに配置されている。

```
kayaba-broadway/          # バックエンド（Hono + Drizzle ORM）
├── src/                  # バックエンドのソースコード
├── frontend/             # フロントエンド（Angular + PixiJS）
│   └── src/
│       └── app/
├── docs/                 # ドキュメント
├── wrangler.jsonc        # Cloudflare Workers 設定
└── .github/
    └── copilot-instructions.md

```

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Angular + PixiJS |
| バックエンド API | Hono + Drizzle ORM（Cloudflare Workers） |
| リアルタイム通信 | Partykit（WebSocket） |
| ビデオ通話 | WebRTC（LiveKit or STUN/TURN） |
| データベース | Cloudflare D1 |
| ファイルストレージ | Cloudflare R2 |
