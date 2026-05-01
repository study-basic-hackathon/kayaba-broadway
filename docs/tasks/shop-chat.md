# タスク: お店チャット機能

## 概要

プレイヤーが店舗ゾーンに入ったとき、その店舗専用のリアルタイムテキストチャットに参加できる機能を実装する。  
Partykit の `shop-{shopId}` ルームを新たに立て、フロントエンドではショップオーバーレイ内にチャット UI を組み込む。

---

## 前提条件

- [x] 店舗ゾーン判定が実装済み（`docs/tasks/shop-zone-detection.md` 参照）
  - `game.component.ts` に `currentShop = signal<Shop | null>(null)` が存在する
  - プレイヤーがゾーンに入ると `currentShop` が更新される

---

## 設計方針

### Partykit ルーム構成

| ルーム ID | 用途 |
|---|---|
| `field-{fieldId}` | 位置同期（既存） |
| `shop-{shopId}` | お店チャット（新規） |

- 店舗ゾーンに入ったとき `shop-{shopId}` に接続、退出したら切断する
- 位置同期ルームとは**別接続**として管理する（メッセージ型の混在を避ける）

### メッセージ仕様

#### フロントエンド → Partykit（送信）

```typescript
type ChatSendMessage = {
  message_type: "chat";
  data: { text: string };
};
```

#### Partykit → フロントエンド（受信）

```typescript
// チャット送信のブロードキャスト
type ChatBroadcastMessage = {
  message_type: "chat";
  data: {
    userId: string;
    displayName: string;
    text: string;
    timestamp: number; // Unix ms
  };
};

// 接続時に直近メッセージ履歴を受け取る
type ChatHistoryMessage = {
  message_type: "chat_history";
  data: {
    messages: ChatBroadcastMessage["data"][];
  };
};
```

### チャット履歴の保持

Partykit の `room.storage` を使い、直近 **50 件** をメモリ上に保持する。  
接続してきたユーザーには `chat_history` メッセージで過去ログを送信する。  
永続化（DB 保存）は今回スコープ外とする。

---

## 実装タスク

### フェーズ1: Partykit — チャットメッセージ処理を追加

- [x] `partykit/party/index.ts` の型定義にチャット用メッセージ型を追加する
  ```typescript
  // フロントエンド → Partykit
  type ChatSendMessage = {
    message_type: "chat";
    data: { text: string };
  };

  // Partykit → フロントエンド
  type ChatBroadcastMessage = {
    message_type: "chat";
    data: { userId: string; displayName: string; text: string; timestamp: number };
  };
  type ChatHistoryMessage = {
    message_type: "chat_history";
    data: { messages: ChatBroadcastMessage["data"][] };
  };
  ```

- [x] `FieldRoom` クラスにチャット履歴を保持するフィールドを追加する
  ```typescript
  private chatHistory: ChatBroadcastMessage["data"][] = [];
  private readonly MAX_CHAT_HISTORY = 50;
  ```

- [x] `onConnect` で接続時に `chat_history` メッセージを送信する
  ```typescript
  const historyMsg: ChatHistoryMessage = {
    message_type: "chat_history",
    data: { messages: this.chatHistory },
  };
  conn.send(JSON.stringify(historyMsg));
  ```

- [x] `onMessage` に `chat` メッセージの処理を追加する
  - テキストの空文字・長さ（最大 200 文字）バリデーション
  - `chatHistory` に追記し、超過分は先頭から削除（最大 50 件維持）
  - 送信者を**含む**全員にブロードキャスト（自分のメッセージも即時表示させるため）
  ```typescript
  if (msg.message_type === "chat") {
    const user = this.users.get(sender.id);
    if (!user) return;
    const text = typeof msg.data.text === "string" ? msg.data.text.trim() : "";
    if (text.length === 0 || text.length > 200) return;

    const entry: ChatBroadcastMessage["data"] = {
      userId: user.userId,
      displayName: user.displayName,
      text,
      timestamp: Date.now(),
    };
    this.chatHistory.push(entry);
    if (this.chatHistory.length > this.MAX_CHAT_HISTORY) {
      this.chatHistory.shift();
    }
    const broadcastMsg: ChatBroadcastMessage = { message_type: "chat", data: entry };
    this.room.broadcast(JSON.stringify(broadcastMsg));
  }
  ```

---

### フェーズ2: フロントエンド — チャット用 Partykit 接続サービス

- [x] `frontend/src/app/services/shop-chat.service.ts` を新規作成する
  - `connect(shopId: string, token: string): void` — `shop-{shopId}` ルームに WS 接続
  - `disconnect(): void` — WS 切断
  - `sendMessage(text: string): void` — `chat` メッセージを送信
  - `messages: Signal<ChatMessage[]>` — 受信済みメッセージ一覧（signal）
  - `connected: Signal<boolean>` — 接続状態（signal）

```typescript
export interface ChatMessage {
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
}
```

---

### フェーズ3: フロントエンド — 店舗ゾーン入退出と接続を連動

- [x] `game.component.ts` で `currentShop` の変化を `effect()` で監視し、接続・切断を制御する
  ```typescript
  effect(() => {
    const shop = this.currentShop();
    if (shop) {
      const token = this.authService.getAccessToken();
      this.shopChatService.connect(shop.id, token);
    } else {
      this.shopChatService.disconnect();
    }
  });
  ```

---

### フェーズ4: フロントエンド — チャット UI の実装

- [x] `game.component.html` の既存ショップオーバーレイにチャット UI を追加する

```html
@if (currentShop) {
  <div class="shop-overlay">
    <span class="shop-name">🏪 {{ currentShop.name }}</span>

    <!-- チャットエリア -->
    <div class="chat-panel">
      <div class="chat-messages" #chatMessages>
        @for (msg of shopChatService.messages(); track msg.timestamp) {
          <div class="chat-message">
            <span class="chat-user">{{ msg.displayName }}</span>
            <span class="chat-text">{{ msg.text }}</span>
          </div>
        }
      </div>
      <div class="chat-input-area">
        <input
          class="chat-input"
          type="text"
          [(ngModel)]="chatInputText"
          (keydown.enter)="sendChatMessage()"
          placeholder="メッセージを入力..."
          maxlength="200"
        />
        <button class="chat-send-btn" (click)="sendChatMessage()">送信</button>
      </div>
    </div>
  </div>
}
```

- [x] `game.component.ts` にチャット送信メソッドを追加する
  ```typescript
  chatInputText = '';

  sendChatMessage() {
    const text = this.chatInputText.trim();
    if (!text) return;
    this.shopChatService.sendMessage(text);
    this.chatInputText = '';
  }
  ```

- [x] `game.component.scss` にチャット UI のスタイルを追加する
  - メッセージエリアは固定高さ（例: 200px）でスクロール可能
  - 新着メッセージ受信時に自動スクロール（`scrollTop = scrollHeight`）

---

## 関連ファイル

| ファイル | 変更内容 |
|---|---|
| `partykit/party/index.ts` | チャットメッセージ型・処理を追加 |
| `frontend/src/app/services/shop-chat.service.ts` | 新規作成（WS 接続管理・メッセージ受信） |
| `frontend/src/app/pages/game/game.component.ts` | `ShopChatService` の注入・`effect` で接続制御・送信メソッド追加 |
| `frontend/src/app/pages/game/game.component.html` | チャット UI を追加 |
| `frontend/src/app/pages/game/game.component.scss` | チャットスタイルを追加 |

---

## スコープ外（将来対応）

- チャット履歴の DB 永続化
- フィールドチャット（フィールド単位のチャットルーム）
- メッセージの削除・通報機能
- 絵文字・スタンプ対応
