# Cloudflare デプロイ手順書

## 本番環境の構成

| コンポーネント | URL | 状態 |
|--------------|-----|------|
| バックエンド API | `https://api.kayaba-broadway.workers.dev` | ✅ デプロイ済み |
| D1 データベース | `kayaba-broadway`（ID: `f3a102f5-aeb0-4fe8-8203-0045e3c4a277`） | ✅ 設定済み |
| R2 ストレージ | `kayaba-broadway-storage` | ✅ 設定済み |
| Partykit（WebSocket） | `wss://kayaba-broadway.yasunariiguchi.partykit.dev` | ✅ デプロイ済み |
| フロントエンド | `https://kayaba-broadway-frontend.pages.dev` | ✅ デプロイ済み |

---

## デプロイは main push で自動実行される

**通常のデプロイ作業は不要。** `main` ブランチに push するだけで CI/CD が自動的に処理する。

```
git push origin main
```

GitHub Actions（`.github/workflows/deploy.yml`）が起動し、以下の3ジョブが**並列**で実行される。

| ジョブ | 内容 |
|--------|------|
| `deploy-backend` | テスト（vitest）→ Cloudflare Workers デプロイ |
| `deploy-partykit` | Partykit（WebSocket サーバー）デプロイ |
| `deploy-frontend` | Angular ビルド → Cloudflare Pages デプロイ |

> `deploy-backend` はテストが通過しないとデプロイされない（フェイルセーフ）。

### push 前にローカルでテストを確認する

```bash
# ルートで実行
npm test
```

5ファイル・23テストが通過することを確認してから push すること。

---

## 手動操作が必要なケース

> ⚠️ 以下は**通常のコード変更では不要**。シークレット更新・DB マイグレーション・初期セットアップ時のみ実施する。

### シークレットの更新（バックエンド）

```bash
# 改行なし（printf 推奨）で渡すこと
printf '<値>' | npx wrangler secret put JWT_SECRET --env=""
printf '<値>' | npx wrangler secret put STRIPE_API_KEY --env=""
printf '<値>' | npx wrangler secret put STRIPE_WEBHOOK_SECRET --env=""
```

> **注意**: `echo` は末尾に改行を付けるため、シークレット値がずれる原因になる。必ず `printf` を使うこと。

### D1 マイグレーションの適用

```bash
# 本番DB に適用（--local なし）
npx wrangler d1 migrations apply kayaba-broadway
```

> シードデータの再投入は実データと混在するため、原則行わない。

### Partykit の JWT_SECRET 更新

バックエンドと **まったく同じ値** を設定すること。値がずれると `4001 Unauthorized` で全接続が切断される。

```bash
cd partykit
printf '<値>' | npx partykit env add JWT_SECRET
npx partykit deploy
```

### フロントエンドの手動デプロイ（緊急時）

```bash
cd frontend
npm run build
cd ..
npx wrangler pages deploy frontend/dist/frontend/browser --project-name kayaba-broadway-frontend
```

#### 環境設定ファイル

`frontend/src/environments/environment.production.ts`:

```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.kayaba-broadway.workers.dev',
  partykitHost: 'kayaba-broadway.yasunariiguchi.partykit.dev',
  stripePublicKey: 'pk_test_51TR8Yd1lp8GZIfDz...',
};
```

> `partykitHost` はスキームなし（`wss://` なし）のホスト名のみ記載する。

#### Angular Router 対応（`_redirects`・`_headers`）

`frontend/public/` に以下のファイルが配置済み。`ng build` 時に自動でコピーされる。

- `_redirects`: `/* /index.html 200`（SPA ルーティング対応）
- `_headers`: `/*.html` と `/` に `Cache-Control: no-store`（古いキャッシュによる不具合防止）

---

## CI/CD の詳細

### GitHub Secrets の登録

**Settings → Secrets and variables → Actions** に以下を登録する（初期セットアップ時のみ）。

| Secret 名 | 説明 | 取得方法 |
|-----------|------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン | Cloudflare ダッシュボード → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID | `5833666f916ca87d1762c18ac1b4b32a` |
| `PARTYKIT_TOKEN` | Partykit デプロイ用トークン | `npx partykit token generate` で生成 |
| `PARTYKIT_LOGIN` | Partykit のログイン名 | `yasunariiguchi`（暫定。Partykit の組織アカウントへ移行時は変更が必要） |

> `PARTYKIT_LOGIN` は現在 `yasunariiguchi`（個人アカウント）を暫定利用している。Partykit を組織アカウントへ移行した際は Secret の値を更新すること。

> Stripe 関連の Secret（`STRIPE_API_KEY` 等）は Workers の Secret として `wrangler secret put` で登録済みのため、CI には不要。

### テスト環境の Bindings

CI の vitest は `wrangler.jsonc` ではなく `vitest.config.ts` の `miniflare.bindings` を参照する。Stripe 等の外部サービス値はダミー値を設定している。

```typescript
// vitest.config.ts（抜粋）
miniflare: {
  bindings: {
    TEST_MIGRATIONS: migrations,
    JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-for-vitest",
    STRIPE_API_KEY: process.env.STRIPE_API_KEY ?? "sk_test_dummy",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_dummy",
    CORS_ORIGIN: "http://localhost:4200",
    ENVIRONMENT: "test",
  },
},
```

---

## CORS 設定

`src/index.ts` で `CORS_ORIGIN` 環境変数をカンマ区切りで読み込む。`wrangler.jsonc` で管理。

```jsonc
// wrangler.jsonc（デフォルト・ローカル開発含む）
"vars": {
  "ENVIRONMENT": "production",
  "CORS_ORIGIN": "http://localhost:4200,https://kayaba-broadway-frontend.pages.dev,https://c009aca8.kayaba-broadway-frontend.pages.dev"
}
```

新しい Pages デプロイの URL（`*.kayaba-broadway-frontend.pages.dev`）を許可する必要が生じた場合は、`wrangler.jsonc` の `CORS_ORIGIN` に追記してバックエンドを再デプロイする。

---

## Stripe Webhook の設定

1. [Stripe ダッシュボード](https://dashboard.stripe.com/webhooks) → Webhook → 「エンドポイントを追加」
2. エンドポイント URL:
   ```
   https://api.kayaba-broadway.workers.dev/payment/webhook
   ```
3. 送信イベント（最低限）:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. 生成された Webhook シークレット（`whsec_...`）を登録:
   ```bash
   printf '<whsec_...>' | npx wrangler secret put STRIPE_WEBHOOK_SECRET --env=""
   ```
