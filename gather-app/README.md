# gather-app

Gather 風の近接ビデオチャット Web アプリ

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | AngularJS 1.8 + TypeScript + Vite |
| ビデオチャット | LiveKit Client SDK v2 |
| 位置情報同期 | PartyKit WebSocket |
| Web API | Cloudflare Workers + Hono (TypeScript) |
| ローカル LiveKit | Docker Compose (livekit-server + Redis) |
| モノレポ管理 | Turborepo + npm workspaces |

## ディレクトリ構成

```
gather-app/
├── apps/
│   ├── frontend/          # AngularJS + Vite
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.module.ts          # Angular モジュール + 環境変数
│   │   │   │   ├── services/
│   │   │   │   │   ├── livekit.service.ts # LiveKit SDK ラッパー
│   │   │   │   │   └── partykit.service.ts# PartyKit 位置同期
│   │   │   │   └── controllers/
│   │   │   │       └── world.controller.ts# メインコントローラー
│   │   │   ├── styles/main.css
│   │   │   └── main.ts
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── .env.local      # VITE_* 環境変数 (gitignore)
│   │
│   ├── api/                # Cloudflare Workers + Hono
│   │   ├── src/index.ts    # トークン発行 API
│   │   ├── wrangler.toml
│   │   └── .dev.vars       # ローカル用シークレット (gitignore)
│   │
│   └── partykit/           # PartyKit サーバー
│       ├── src/server.ts   # 位置情報 WebSocket サーバー
│       └── partykit.json
│
├── packages/
│   └── shared/
│       └── src/index.ts    # 共有型定義 + 近接距離定数
│
├── docker-compose.yml      # LiveKit Server + Redis
├── livekit.yaml            # LiveKit 設定
└── turbo.json
```

---

## クイックスタート（ローカル開発）

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. LiveKit サーバーを起動（Docker が必要）

```bash
npm run livekit:up
# → LiveKit: ws://localhost:7880
# → Redis:   localhost:6379
```

### 3. Cloudflare Workers API を起動

```bash
cd apps/api
# .dev.vars はすでに配置済み (livekit.yaml のキーと一致)
npx wrangler dev --env local
# → http://localhost:8787
```

### 4. PartyKit サーバーを起動

```bash
cd apps/partykit
npx partykit dev
# → ws://localhost:1999
```

### 5. フロントエンドを起動

```bash
cd apps/frontend
npx vite
# → http://localhost:5173
```

または Turborepo で一括起動（ターミナルを4つ開かずに済む）:

```bash
npm run dev
```

---

## 本番デプロイ

### API (Cloudflare Workers)

```bash
# シークレットを登録
cd apps/api
npx wrangler secret put LIVEKIT_API_KEY
npx wrangler secret put LIVEKIT_API_SECRET

# デプロイ
npx wrangler deploy
```

### PartyKit

```bash
cd apps/partykit
npx partykit deploy
# → https://gather-party.<your-user>.partykit.dev
```

### フロントエンド

`apps/frontend/.env.local` を本番値に更新して build:

```bash
VITE_LIVEKIT_URL=wss://your-app.livekit.cloud
VITE_API_BASE_URL=https://gather-api.<subdomain>.workers.dev
VITE_PARTYKIT_HOST=gather-party.<user>.partykit.dev
```

```bash
cd apps/frontend
npx vite build
# dist/ を任意の静的ホスティングに配置
```

---

## Oracle Cloud でセルフホスト LiveKit に切り替える

`livekit.yaml` の内容を Oracle Cloud のインスタンスに配置して起動するだけです。

```yaml
# livekit.yaml (Oracle Cloud 用に変更する箇所)
rtc:
  use_external_ip: true
  node_ip: "your.oracle.public.ip"  # Oracle の Public IP
```

フロントエンドの接続先変更:
```
VITE_LIVEKIT_URL=wss://your.oracle.public.ip:7880
```

API の `.dev.vars` / wrangler secret も Oracle の `livekit.yaml` と同じキーに揃えるだけ。
**コードの変更は一切不要。**

---

## 近接チェックの仕組み

`packages/shared/src/index.ts` の `PROXIMITY` 定数で全アプリ共通に制御:

```typescript
CONNECT_DIST    = 150   // この距離以内に入ると LiveKit 接続
DISCONNECT_DIST = 220   // この距離を超えると切断 (ヒステリシス)
TOAST_DIST      = 280   // 「近くにいます」トーストの表示開始距離
```

ヒステリシス（接続閾値 < 切断閾値）を設けることで境界付近でのチラつきを防いでいます。

---

## 位置情報同期フロー

```
[自分が移動]
    ↓
PartyKitService.sendPosition(x, y)
    ↓  WebSocket (partysocket)
[PartyKit Server]
    ↓  broadcast to others
他プレイヤーの RemotePlayer.x / .y が更新
    ↓
Canvas ゲームループが getPlayers() で毎フレーム読む
    ↓
近接チェック → LiveKit 接続/切断
```

---

## AngularJS ↔ LiveKit イベント連携

LiveKit のイベントは Angular の digest サイクル外で発火するため、`$timeout` でラップして `$rootScope.$broadcast` 経由で通知しています:

```typescript
room.on(RoomEvent.TrackSubscribed, (track, _, participant) => {
  this.$timeout(() => {
    this.$rootScope.$broadcast("lk:trackSubscribed", { track, participant });
  });
});
```

コントローラーでは `$scope.$on` で受け取り、`$timeout` で DOM 生成を待ってから `track.attach(el)` します。
