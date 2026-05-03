# タスク仕様書：リアルタイムマルチプレイヤー同期

> **ステータス：✅ 完了**

## 概要

`/game` 画面を複数人が開いたとき、Partykit（WebSocket）を使って各ユーザーのキャラクター位置をリアルタイムに同期する。

---

## 対応した問題点（解決済み）

| 箇所 | 問題 | 対応 |
|------|------|------|
| `game.component.ts` の `initSocket()` | メッセージ処理が旧フォーマット（`data.type`・`data.id`・`data.players`）のまま | `message_type` + `data` 構造に更新 |
| `game.component.ts` の `initSocket()` | `room: 'room1'` とハードコーディング | ルートパラメータ `fieldId` を使用するよう変更 |
| `game.component.ts` の `update()` | 送信メッセージが旧フォーマット（`{ type: 'move', x, y }`）のまま | `{ message_type: 'move', data: { x, y } }` に更新 |
| `game.component.ts` の `initSocket()` | 認証トークンを PartySocket に渡しておらず `4001 Unauthorized` で拒否 | クエリパラメータ `?token=` で渡すよう変更 |
| `fields.component.ts` の `onClick()` | フィールドIDをルーターに渡していないため同じルームに入る | `router.navigate(['/game', id])` に変更 |

---

## 実装仕様

### 1. フィールドIDをゲーム画面に渡す（`fields.component.ts`）

`onClick(id)` で `/game/:fieldId` へ遷移するように変更する。

```typescript
this.router.navigate(['/game', id]);
```

ルーティングも `/game/:fieldId` に変更する（`app.routes.ts`）。

---

### 2. 認証トークンを PartySocket に渡す（`game.component.ts`）

Partykit サーバーは接続時に JWT を要求する。ブラウザの WebSocket API はカスタムヘッダーを付与できないため、クエリパラメータ `?token=` でトークンを渡す。

> **注意：** `Sec-WebSocket-Protocol`（`protocols` オプション）でトークンを渡す方式は、サーバーがプロトコル選択を返さないと接続拒否されるため不採用。クエリパラメータ方式に統一。

```typescript
this.socket = new PartySocket({
  host: '127.0.0.1:1999',
  room: fieldId,  // ルートパラメータから取得
  ...(token ? { query: { token } } : {}),
});
```

アクセストークンは `AuthService` から取得する。

---

### 3. メッセージ送受信フォーマットを新仕様に対応（`game.component.ts`）

[docs/partykit.md](../partykit.md) に定義された `message_type` + `data` フォーマットに合わせる。

#### 送信（move）

```typescript
this.socket.send(JSON.stringify({
  message_type: 'move',
  data: { x: this.x, y: this.y },
}));
```

#### 受信

```typescript
switch (msg.message_type) {
  case 'init':
    for (const u of msg.data.users) {
      this.addOtherPlayer(u.userId, u.displayName, u.x, u.y);
    }
    break;
  case 'join':
    this.addOtherPlayer(msg.data.userId, msg.data.displayName, msg.data.x, msg.data.y);
    break;
  case 'move': {
    const p = this.otherPlayers.get(msg.data.userId);
    if (p) {
      p.graphics.x = msg.data.x;
      p.graphics.y = msg.data.y;
      p.label.x = msg.data.x;
      p.label.y = msg.data.y - 28;
    }
    break;
  }
  case 'leave': {
    const p = this.otherPlayers.get(msg.data.userId);
    if (p) {
      this.app.stage.removeChild(p.graphics);
      this.app.stage.removeChild(p.label);
      this.otherPlayers.delete(msg.data.userId);
    }
    break;
  }
}
```

---

## 実装計画

### ✅ Step 1：ルーティングにフィールドIDを追加

- `app.routes.ts` の `/game` を `/game/:fieldId` に変更
- `fields.component.ts` の `onClick(id)` で `router.navigate(['/game', id])` に変更

### ✅ Step 2：`game.component.ts` でフィールドIDを受け取る

- `ActivatedRoute` から `fieldId` を取得
- `initSocket()` に渡してルームIDとして使用

### ✅ Step 3：PartySocket に認証トークンを渡す

- `AuthService` からアクセストークンを取得
- `PartySocket` の `query: { token }` オプションでクエリパラメータ送信に統一

### ✅ Step 4：メッセージフォーマットを新仕様に更新

- 受信処理（`initSocket()`）を `message_type` + `data` に対応
- 送信処理（`update()`）を新フォーマットに変更

### ✅ Step 5：動作確認

- 別ブラウザ（通常 + シークレットモード）で2ユーザーがログインし、互いの動きが反映されることを確認
- ルームIDがフィールドIDになっていることを確認

---

## 影響範囲

| ファイル | 変更内容 |
|----------|---------|
| `frontend/src/app/app.routes.ts` | `/game` → `/game/:fieldId` |
| `frontend/src/app/pages/fields/fields.component.ts` | `onClick` でフィールドIDをルートパラメータに渡す |
| `frontend/src/app/pages/game/game.component.ts` | ルートパラメータ取得・認証トークン付与・メッセージフォーマット更新 |
| `partykit/party/index.ts` | クエリパラメータ経由のトークン受け渡し対応、および `displayName` 付与を含む接続・同期処理の更新 |

フロントエンドに加えて、Partykit サーバー側（`partykit/party/index.ts`）にも認証情報の受け渡し方法とプレイヤー情報の扱いに関する変更が入る。
