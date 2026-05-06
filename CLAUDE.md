# CLAUDE.md

## プロジェクト概要

**茅場ブロードウェイ** は、仮想空間（2Dマップ）を自由に歩き回りながら、デジタルコンテンツ（PDF同人誌等）を購入できるオンラインマーケットサービス。

## ドキュメント一覧

| ファイル | 説明 |
|----------|------|
| [README.md](README.md) | プロジェクト概要・セットアップ・開発・テスト・デプロイ手順 |
| [docs/design-doc.md](docs/design-doc.md) | Design Doc。コンセプト・機能要件・画面構成・システム構成・DB/API初期設計をまとめたメインドキュメント |
| [docs/api-endpoints.md](docs/api-endpoints.md) | APIエンドポイント一覧。実装済みエンドポイントの仕様・リクエスト・レスポンス例をまとめたドキュメント |
| [docs/system-flow.md](docs/system-flow.md) | システムフロー図。フロントエンド・バックエンド・Partykit 間の処理フローをMermaidシーケンス図で記述 |
| [docs/partykit.md](docs/partykit.md) | Partykit 仕様書。接続URL・認証・メッセージ仕様・ライフサイクル・ローカル開発手順をまとめたドキュメント |
| [docs/cloudflare-deploy.md](docs/cloudflare-deploy.md) | Cloudflare デプロイ手順書。本番環境の構成・CI/CD（GitHub Actions）・手動操作が必要なケース・GitHub Secrets の登録方法をまとめたドキュメント |

## 参照スキルガイド（Skills）

特定のタスクを実行する際は、必ず以下の対応するスキルを参照し、その指針に従ってください。

- **バックエンド API の実装・追加**
  - Hono ルート・テストの作成規約、エンドポイント仕様
  - 📄 `.github/skills/backend-api/SKILL.md`

## リポジトリ構成

バックエンド（Cloudflare Workers / Hono）がルートに、フロントエンド（Angular）が `frontend/`、Partykit サーバーが `partykit/` サブディレクトリに配置されている。

```
kayaba-broadway/          # バックエンド（Hono + Drizzle ORM）
├── src/                  # バックエンドのソースコード
├── frontend/             # フロントエンド（Angular + PixiJS）
│   └── src/
│       └── app/
├── partykit/             # Partykit サーバー（WebSocket / リアルタイム通信）
│   └── party/
│       └── index.ts
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
