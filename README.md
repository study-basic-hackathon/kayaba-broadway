# 茅場ブロードウェイ

仮想空間（2Dマップ）を自由に歩き回りながら、デジタルコンテンツ（PDF同人誌等）を購入できるオンラインマーケットサービス。

---

## バックエンド（`/`）

Hono + Drizzle ORM による REST API。Cloudflare Workers 上で動作する。

### セットアップ

```bash
npm install
```

### 環境変数の設定

`.dev.vars.example` をコピーして `.dev.vars` を作成し、値を埋める。

```bash
cp .dev.vars.example .dev.vars
```

```bash
# .dev.vars
JWT_SECRET=your_secret_here
```

### 開発サーバー起動

```bash
npm run dev
# http://localhost:8787
```

### テスト

```bash
npx vitest run
```

ウォッチモードで実行する場合：

```bash
npx vitest
```

### デプロイ

```bash
npm run deploy
```

### 型生成

```bash
npm run cf-typegen
```

---

## Partykit（`/partykit`）

WebSocket によるリアルタイムのキャラクター位置同期サーバー。

### セットアップ

```bash
cd partykit
npm install
```

### 環境変数の設定

`.env.example` をコピーして `.env` を作成し、値を埋める。

```bash
cp .env.example .env
```

```bash
# partykit/.env
JWT_SECRET=your_secret_here
```

> 本番環境へのデプロイ時は `npx partykit secret add JWT_SECRET` でシークレットを登録する。

### 開発サーバー起動

```bash
cd partykit
npm run dev
# ws://localhost:1999
```

### wscat で疎通確認

```bash
# インストール（未インストールの場合）
npm install -g wscat

# バックエンドでトークンを取得してから接続
wscat -c "ws://localhost:1999/party/field-1?token=<accessToken>"

# 移動メッセージを送信
> {"type":"move","x":100,"y":200}
```

> `userId` は接続時の JWT の `sub` から決定されます。`move` メッセージに `userId` を含めても無視されます。

### デプロイ

```bash
cd partykit
npm run deploy
```

---

## フロントエンド（`/frontend`）

Angular + PixiJS による 2D マップ UI。

### セットアップ

```bash
cd frontend
npm install
```

### 開発サーバー起動

```bash
cd frontend
npm start
# http://localhost:4200
```

