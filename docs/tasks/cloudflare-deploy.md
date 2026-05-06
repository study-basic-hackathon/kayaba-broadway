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

## 再デプロイ手順

### バックエンド（Cloudflare Workers）

```bash
npm run deploy
# = npx wrangler deploy --minify
```

Workers 名は `api`（`wrangler.jsonc` の `name` フィールド）のため、URL は `https://api.kayaba-broadway.workers.dev` になる。

#### シークレットの更新が必要な場合

```bash
# 改行なし（printf 推奨）で渡すこと
printf '<値>' | npx wrangler secret put JWT_SECRET --env=""
printf '<値>' | npx wrangler secret put STRIPE_API_KEY --env=""
printf '<値>' | npx wrangler secret put STRIPE_WEBHOOK_SECRET --env=""
```

> **注意**: `echo` は末尾に改行を付けるため、シークレット値がずれる原因になる。必ず `printf` を使うこと。

#### D1 マイグレーションの適用

```bash
# 本番DB に適用（--local なし）
npx wrangler d1 migrations apply kayaba-broadway
```

> シードデータの再投入は実データと混在するため、原則行わない。

---

### Partykit（WebSocket サーバー）

```bash
cd partykit
npx partykit deploy
```

#### JWT_SECRET の更新が必要な場合

バックエンドと **まったく同じ値** を設定すること。値がずれると `4001 Unauthorized` で全接続が切断される。

```bash
cd partykit
printf '<値>' | npx partykit env add JWT_SECRET
npx partykit deploy
```

---

### フロントエンド（Cloudflare Pages）

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

---

## 動作確認チェックリスト

- [ ] バックエンド: `GET https://api.kayaba-broadway.workers.dev/` が 200 を返す
- [ ] ログイン・登録が正常に動作する（Cookie の `SameSite=None; Secure` が効いている）
- [ ] リロードしても 401 にならない（リフレッシュトークンが正常に送受信されている）
- [ ] Partykit: フィールド画面でキャラクターの位置同期が動作する（`4001` が出ないこと）
- [ ] チャット: 店舗ゾーン内でメッセージの送受信が動作する
- [ ] Stripe: テスト決済が完了し、購入レコードが D1 に記録される
- [ ] フロントエンド: `/login` や `/game/xxx` を直接 URL 入力・リロードしても 404 にならない
