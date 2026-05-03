# 茅場ブロードウェイ

仮想空間（2Dマップ）を歩き回りながらデジタルコンテンツを購入できるオンラインマーケット。

- **バックエンド**: Hono + Drizzle ORM（Cloudflare Workers）
- **フロントエンド**: Angular + PixiJS

---

## バックエンド（`/`）

バックエンドとフロントエンドそれぞれで依存関係をインストールする。

```txt
# バックエンド（ルートディレクトリ）
npm install

# フロントエンド
cd frontend && npm install
```

### 2. 環境変数の設定

**バックエンド**: `.dev.vars.example` をコピーして `.dev.vars` を作成し、値を埋める。

```bash
cp .dev.vars.example .dev.vars
```

```bash
# .dev.vars
JWT_SECRET=your_secret_here
```

**Partykit**: `partykit/.env.example` をコピーして `partykit/.env` を作成し、値を埋める。

```bash
cp partykit/.env.example partykit/.env
```

```bash
# partykit/.env
JWT_SECRET=your_secret_here  # バックエンドと同じ値を設定する
```

## 起動

**バックエンド**（ルートディレクトリ）:

```bash
npm run dev
# http://localhost:8787
```

**フロントエンド**（`frontend/` ディレクトリ）:

```bash
cd frontend
npm run start
# http://localhost:4200
```

**Partykit**（`partykit/` ディレクトリ）:

```bash
cd partykit
npm run dev
# ws://localhost:1999
```

### VS Code から起動する場合

`.vscode/launch.json` に起動設定が用意されている。VS Code の「実行とデバッグ」パネルから以下を選択して起動できる。

| 設定名 | 説明 |
| ------ | ---- |
| `バックエンド (wrangler dev)` | バックエンドのみ起動（`http://localhost:8787`） |
| `フロントエンド (ng serve)` | フロントエンドのみ起動（`http://localhost:4200`） |
| `Partykit (partykit dev)` | Partykitのみ起動（`ws://localhost:1999`） |
| `フロント + バック 同時起動` | バックエンドとフロントエンドを同時に起動 |
| `フロント + バック + Partykit 同時起動` | 3つすべてを同時に起動 |

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

# バックエンドでトークンを取得してから接続（クエリパラメータでトークンを渡す）
wscat -c "ws://localhost:1999/party/field-1?token=<accessToken>"

# 移動メッセージを送信
> {"message_type":"move","data":{"x":100,"y":200}}
```

> `userId` は接続時の JWT の `id` から決定されます。`move` メッセージに `userId` を含めても無視されます。

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

