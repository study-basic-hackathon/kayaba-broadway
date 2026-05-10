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
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=xxx
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret-at-least-32-chars-long!!
LIVEKIT_WS_URL=ws://localhost:7880
```

> `LIVEKIT_API_KEY` と `LIVEKIT_API_SECRET` は `livekit.yaml` の `keys` と一致させる。ローカル開発では `devkey: secret-at-least-32-chars-long!!` を使用する。

**Partykit**: `partykit/.env.example` をコピーして `partykit/.env` を作成し、値を埋める。

```bash
cp partykit/.env.example partykit/.env
```

```bash
# partykit/.env
JWT_SECRET=your_secret_here  # バックエンドと同じ値を設定する
```

## 起動

### マイグレーション

はじめて起動する前、またはマイグレーションファイルに変更があった場合は以下を実行する。

```bash
npx wrangler d1 migrations apply kayaba-broadway --local
```

初回セットアップ時はシードデータも投入する。

```bash
npx wrangler d1 execute kayaba-broadway --local --file=seeds/seed.sql
```

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

**Livekit**（ルートディレクトリ）:

※ あらかじめdockerを使用できるようにしてください

```bash
npm run livekit:up
# ws://localhost:7880
```

なお、LiveKit Serverを止める場合は

```bash
npm run livekit:down
```

ログを確認する場合:

```bash
npm run livekit:logs
```

### VS Code から起動する場合

`.vscode/launch.json` に起動設定が用意されている。VS Code の「実行とデバッグ」パネルから以下を選択して起動できる。

| 設定名                                  | 説明                                              |
| --------------------------------------- | ------------------------------------------------- |
| `バックエンド (wrangler dev)`           | バックエンドのみ起動（`http://localhost:8787`）   |
| `フロントエンド (ng serve)`             | フロントエンドのみ起動（`http://localhost:4200`） |
| `Partykit (partykit dev)`               | Partykitのみ起動（`ws://localhost:1999`）         |
| `フロント + バック 同時起動`            | バックエンドとフロントエンドを同時に起動          |
| `フロント + バック + Partykit 同時起動` | 3つすべてを同時に起動                             |

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

## LiveKit

ショップ内でのビデオチャットに LiveKit を使用する。プレイヤーが店舗ゾーンに入ると、フロントエンドがバックエンドの `GET /shops/:id/livekit/token` を呼び出し、返却された LiveKit token と WebSocket URL で LiveKit Server に接続する。店舗ゾーンから出る、別店舗へ移動する、またはゲーム画面を離れると切断される。

### ローカル構成

ローカル開発では Docker Compose で LiveKit Server と Redis を起動する。

```bash
npm run livekit:up
```

主な設定ファイル:

- `docker-compose.yml`: LiveKit Server と Redis の起動定義
- `livekit.yaml`: LiveKit Server の API key、secret、RTC port 設定
- `.dev.vars`: バックエンドが LiveKit token を発行するための環境変数

ローカルの既定値:

```bash
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret-at-least-32-chars-long!!
LIVEKIT_WS_URL=ws://localhost:7880
```

`LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` は `livekit.yaml` の `keys` と同じ値にする。値が一致しない場合、バックエンドで token は発行できても LiveKit Server 側で認証に失敗する。

### 接続フロー

1. フロントエンドの `game.component.ts` が現在の店舗 ID をもとに `GET /shops/:id/livekit/token` を呼び出す。
2. バックエンドの `src/routes/shops.ts` が認証済み JWT の `id` を LiveKit identity として token を生成する。
3. フロントエンドの `LiveKitService` が `LIVEKIT_WS_URL` と token を使って room に参加する。
4. room 名は `shop-<shopId>` になる。

LiveKit identity はフロントエンドから送られた任意値ではなく、バックエンドで検証済みのアクセストークンから決定される。

### 本番環境

本番で LiveKit Cloud またはセルフホスト LiveKit を使う場合は、Workers の secret / vars に以下を設定する。

```bash
npx wrangler secret put LIVEKIT_API_KEY
npx wrangler secret put LIVEKIT_API_SECRET
npx wrangler secret put LIVEKIT_WS_URL
```

`LIVEKIT_WS_URL` は LiveKit の WebSocket URL を指定する。

```bash
# LiveKit Cloud の例
wss://your-app.livekit.cloud

# セルフホストの例
wss://your-livekit.example.com
```

セルフホストする場合は、LiveKit Server 側の `keys` と Workers 側の `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` を揃える。

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
