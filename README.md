# kayaba-broadway

Hono + Cloudflare Workers による JWT 認証 API。

## セットアップ

### 1. 依存関係のインストール

```txt
npm install
```

### 2. 環境変数の設定

`.dev.vars.example` をコピーして `.dev.vars` を作成し、値を埋める。

```txt
cp .dev.vars.example .dev.vars
```

```txt
# .dev.vars
JWT_SECRET=your_secret_here
```

## 開発

```txt
npm run dev
```

## デプロイ

```txt
npm run deploy
```

## API エンドポイント

| メソッド | パス     | 説明                 |
| -------- | -------- | -------------------- |
| POST     | `/login` | ログイン・JWT 取得   |
| GET      | `/auth`  | 認証確認（JWT 必須） |

### POST /login

**リクエスト**

```json
{
  "mail": "shun@gmail.com",
  "password": "1234"
}
```

**レスポンス（成功）**

```json
{
  "token": "<JWT>"
}
```

**レスポンス（失敗）**

```json
{
  "error": "認証失敗"
}
```

### GET /auth

`Authorization: Bearer <JWT>` ヘッダーが必要。

```json
{
  "msg": "認証済み"
}
```

## 型生成

Worker の設定に基づいて `CloudflareBindings` 型を生成・同期する。

```txt
npm run cf-typegen
```
