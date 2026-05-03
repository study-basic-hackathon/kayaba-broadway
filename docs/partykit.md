# Partykit 仕様書

## 概要

Partykit は WebSocket ベースのリアルタイム通信サーバー。  
茅場ブロードウェイでは、フィールド上の**他ユーザーのキャラクター位置をリアルタイムに同期**するために使用する。

---

## ディレクトリ構成（現状）

```
kayaba-broadway/
├── src/              # バックエンド（Hono + Drizzle ORM）
├── frontend/         # フロントエンド（Angular + PixiJS）
└── partykit/         # Partykit サーバー
    ├── party/
    │   └── index.ts  # ルーム定義（メインの実装）
    ├── partykit.json  # Partykit の設定ファイル
    └── package.json   # Partykit 独自の依存関係
```

---

## 接続仕様

### 接続URL

| 環境 | URL |
|------|-----|
| ローカル開発 | `ws://localhost:1999/party/:roomId` |
| 本番 | `wss://<project>.partykit.dev/party/:roomId` |

### ルームID

フィールドIDをルームIDとして使用する。

```
ws://localhost:1999/party/field-1
```

- フィールドごとに独立したルームになるため、将来複数フィールドに対応できる
- 同じフィールドにいるユーザーだけが同じルームに入る

### 認証

接続時にクエリパラメータでトークンを送信する。Partykit サーバーの `onConnect` で JWT を検証し、無効なら接続を拒否する。

```
ws://localhost:1999/party/field-1?token=<accessToken>
```

> ブラウザの WebSocket API はカスタムヘッダーを付与できないため、クエリパラメータを使用する。

```
// バックエンドと Partykit で同じ JWT_SECRET を共有する（HS256）
// 将来的には RS256/ES256 の非対称鍵に移行することでシークレット共有が不要になる
```

---

## メッセージ仕様

すべてのメッセージは JSON 文字列でやり取りする。

### フロントエンド → Partykit

#### `move`：キャラクター移動

キャラクターが移動するたびに送信する。  
送信者の `userId` は Partykit サーバー側で**接続に紐づく認証済みユーザー情報から決定**するため、クライアントは `userId` を送信しない。

```json
{
  "message_type": "move",
  "data": {
    "x": 320,
    "y": 200
  }
}
```

### Partykit → フロントエンド

#### `move`：他ユーザーの移動をブロードキャスト

送信者以外の全員に転送する。

```json
{
  "message_type": "move",
  "data": {
    "userId": "user-abc123",
    "x": 320,
    "y": 200
  }
}
```

#### `join`：ユーザー入室通知

新しいユーザーが接続した際に既存ユーザー全員へ通知する。  
初期座標はフィールドの入口（`x: 0, y: 0`）固定とする。

```json
{
  "message_type": "join",
  "data": {
    "userId": "user-abc123",
    "x": 0,
    "y": 0
  }
}
```

#### `leave`：ユーザー退室通知

ユーザーが切断した際に残っている全員へ通知する。

```json
{
  "message_type": "leave",
  "data": {
    "userId": "user-abc123"
  }
}
```

#### `init`：初期状態の通知

接続直後に、現在ルームにいる全ユーザーの位置情報を返す。

```json
{
  "message_type": "init",
  "data": {
    "users": [
      { "userId": "user-xyz456", "x": 100, "y": 150 },
      { "userId": "user-def789", "x": 200, "y": 300 }
    ]
  }
}
```

---

## サーバー側のライフサイクル

| フック | タイミング | やること |
|--------|-----------|---------|
| `onConnect` | 新規接続時 | JWT 検証 → 無効なら拒否。有効なら初期座標 `(0, 0)` でユーザーをルームに追加し、`init` メッセージで現在の全ユーザー位置を返す。`join (x:0, y:0)` を全員にブロードキャスト |
| `onMessage` | メッセージ受信時 | `message_type` に応じて処理。`move` は送信者以外全員にブロードキャスト |
| `onClose` | 切断時 | `leave` を残っている全員にブロードキャスト。ルームの状態からそのユーザーを削除 |

---

## ルーム内の状態管理

Partykit はルームごとにインメモリで状態を持てる。  
以下のデータをルーム内で管理する。

```typescript
// ルーム内で保持するユーザー情報
type UserState = {
  userId: string;
  x: number;
  y: number;
};

// connectionId → UserState のマップ
const users = new Map<string, UserState>();
```

---

## ローカル開発・動作確認

### 起動

```bash
npx partykit dev --config partykit/partykit.json
```

`http://localhost:1999` でサーバーが起動する。

### wscat で疎通確認

```bash
# インストール（未インストールの場合）
npm install -g wscat

# 接続（tokenはバックエンドのPOST /auth/loginで取得したもの）
wscat -c "ws://localhost:1999/party/field-1?token=<accessToken>"

# 移動メッセージを送信
> {"message_type":"move","data":{"x":100,"y":200}}
```

### デプロイ

```bash
npx partykit deploy
```

---

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `JWT_SECRET` | JWT の検証に使用するシークレット。バックエンドと同じ値を設定する |

`partykit.json` の `vars` または Partykit ダッシュボードで設定する。

---

## 関連ドキュメント

- [docs/system-flow.md](./system-flow.md) — フロントエンド・バックエンド・Partykit 間の全体フロー
- [docs/design-doc.md](./design-doc.md) — システム構成・技術スタック
