# kayaba-broadway

仮想空間（2Dマップ）を歩き回りながらデジタルコンテンツを購入できるオンラインマーケット。

- **バックエンド**: Hono + Drizzle ORM（Cloudflare Workers）
- **フロントエンド**: Angular + PixiJS

## セットアップ

### 1. 依存関係のインストール

バックエンドとフロントエンドそれぞれで依存関係をインストールする。

```txt
# バックエンド（ルートディレクトリ）
npm install

# フロントエンド
cd frontend && npm install
```

### 2. 環境変数の設定（バックエンド）

`.dev.vars.example` をコピーして `.dev.vars` を作成し、値を埋める。

```txt
cp .dev.vars.example .dev.vars
```

```txt
# .dev.vars
JWT_SECRET=your_secret_here
```

## 起動

**バックエンド**（ルートディレクトリ）:

```txt
npm run dev
```

**フロントエンド**（`frontend/` ディレクトリ）:

```txt
cd frontend
npm run start
```

### VS Code から起動する場合

`.vscode/launch.json` に起動設定が用意されている。VS Code の「実行とデバッグ」パネルから以下を選択して起動できる。

| 設定名 | 説明 |
| ------ | ---- |
| `バックエンド (wrangler dev)` | バックエンドのみ起動（`http://localhost:8787`） |
| `フロントエンド (ng serve)` | フロントエンドのみ起動（`http://localhost:4200`） |
| `フロント + バック 同時起動` | 両方を同時に起動（上記2つのcompound） |

## デプロイ

```txt
npm run deploy
```

## テスト

バックエンドのテストを実行する。

```txt
npx vitest run
```

ウォッチモードで実行する場合：

```txt
npx vitest
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
