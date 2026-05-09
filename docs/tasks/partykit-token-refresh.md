# タスク仕様書：Partykit 接続のトークン期限切れ対応

> **ステータス：🔲 未着手**

## 概要

アクセストークンの有効期限（15分）が切れると、Partykit の WebSocket 接続が `4001 Unauthorized` で切断され、以下の問題が発生する。

- 他のユーザーが画面から消える
- 過去のチャット履歴が見えなくなる
- チャットが送信できなくなる

リフレッシュトークン（有効期限7日）を使って新しいアクセストークンを取得し、Partykit に繋ぎ直すことでこれらを解決する。

---

## 原因の整理

| 要素 | 内容 |
|------|------|
| アクセストークン有効期限 | 15分（`ACCESS_TOKEN_EXPIRES_IN = 60 * 15`） |
| リフレッシュトークン有効期限 | 7日（`REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7`） |
| Partykit の接続認証 | `onConnect` で JWT の `exp` を検証し、期限切れなら `close(4001)` |
| `PartySocket` の自動再接続 | 初期化時に固定したトークンで再接続を試みるため、期限切れ後は繋ぎ直せない |
| チャット履歴・init の送信タイミング | `onConnect` 時のみ → 再接続失敗後は届かない |

---

## 実装方針

### 1. 切断検知（`game.component.ts`）

`socket` の `close` イベントを監視し、`code === 4001` のときにトークンリフレッシュ → 再接続のフローを実行する。

```typescript
this.socket.addEventListener('close', async (event) => {
  if (event.code === 4001) {
    await this.reconnectWithTokenRefresh(fieldId);
  }
});
```

### 2. トークンリフレッシュ（`AuthService`）

`AuthService.refresh()` はすでに実装済み。呼び出すと Hono の `/auth/refresh` エンドポイントにリクエストが飛び、新しいアクセストークンが `localStorage` に保存される。

```typescript
await firstValueFrom(this.auth.refresh());
// → localStorage['accessToken'] が新トークンに更新される
```

### 3. Partykit 再接続（`game.component.ts`）

`PartySocket` の `query.token` は初期化時に固定されるため、`close()` してから新しいトークンで `new PartySocket(...)` を作り直す。既存の `initSocket(fieldId)` をそのまま再利用できる。

```typescript
private async reconnectWithTokenRefresh(fieldId: string) {
  try {
    await firstValueFrom(this.auth.refresh()); // 新トークン取得・localStorage 更新
  } catch {
    // リフレッシュ失敗（7日期限切れ等）はログアウト扱いにするなど要検討
    return;
  }
  this.socket?.close();
  this.initSocket(fieldId); // 新トークンで再接続
}
```

再接続後、Partykit サーバーの `onConnect` が呼ばれ、`chat_history` と `init`（他ユーザー一覧）が自動的に再送されてくる。

### 4. 再接続時の otherPlayers のクリア

再接続すると `init` で全ユーザーが再通知されるため、繋ぎ直し前に `otherPlayers` のステージオブジェクトをクリアしておく必要がある。

---

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `frontend/src/app/pages/game/game.component.ts` | `initSocket()` に `close` イベントハンドラを追加、`reconnectWithTokenRefresh()` メソッドを追加、再接続前の `otherPlayers` クリア処理を追加 |

バックエンド（Hono）・Partykit サーバー側の変更は**不要**。

---

## 考慮事項

- **リフレッシュ失敗時**（リフレッシュトークンも期限切れ・無効化された場合）: ログアウト処理を行い、ログイン画面へリダイレクトするのが自然な挙動。
- **再接続中の多重実行防止**: `close` イベントが連続して発火するケースに備え、再接続中フラグを持つことを検討する。
- **チャットの再表示**: 再接続後に `chat_history` が届くため、フロントエンドで重複表示にならないよう既存メッセージをクリアしてから受信する。
