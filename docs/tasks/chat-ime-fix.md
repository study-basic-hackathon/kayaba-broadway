# チャット入力のIME対応修正

## 概要

iPhoneのSafariを含むモバイルブラウザで、日本語入力時にIME（Input Method Editor）の変換中の未確定文字が正しく送信されない問題を修正。

## 問題

### 修正前の動作

- **日本語入力中（未変換状態）にEnterキーを押す**
  - IMEが先に変換を確定してしまい、入力フィールドの`keydown.enter`イベントが正しく発火しない
  - 結果として、未変換の文字が送信されない

- **送信ボタンをクリック**
  - IME変換中の未確定文字は送信されない
  - ngModelの更新タイミングの問題で、最新の入力値が反映されないケースがある

### 根本原因

- IMEのcompositionイベント（`compositionstart`、`compositionend`）を追跡していなかった
- 変換中のEnterキーを適切に処理していなかった
- 送信ボタンクリック時にIME確定を待つ処理がなかった

## 解決策

### 実装内容

#### 1. IME変換状態の追跡

**TypeScript** ([game.component.ts](../../frontend/src/app/pages/game/game.component.ts))

```typescript
// IME変換中フラグを追加
private isComposing = false;

onCompositionStart() {
  this.isComposing = true;
}

onCompositionEnd() {
  this.isComposing = false;
}

onChatInputKeydown(event: KeyboardEvent) {
  // IME変換中（未確定状態）の場合はEnterキーを無視
  if (event.key === 'Enter' && !this.isComposing) {
    event.preventDefault();
    this.sendChatMessage();
  }
}
```

**HTML** ([game.component.html](../../frontend/src/app/pages/game/game.component.html))

```html
<input
  #chatInput
  class="chat-input"
  type="text"
  [(ngModel)]="chatInputText"
  (keydown)="onChatInputKeydown($event)"
  (compositionstart)="onCompositionStart()"
  (compositionend)="onCompositionEnd()"
  (focus)="onChatInputFocus()"
  (blur)="onChatInputBlur()"
  placeholder="メッセージを入力..."
  maxlength="200"
  autocomplete="off"
/>
```

#### 2. 送信ボタンクリック時の未変換文字対応

**TypeScript** ([game.component.ts](../../frontend/src/app/pages/game/game.component.ts))

```typescript
// 入力フィールドへの参照を追加
@ViewChild('chatInput') chatInputEl?: ElementRef<HTMLInputElement>;

sendChatMessage(fromButton: boolean = false) {
  // ボタンクリック時は、IME変換中でも確定させて送信
  if (fromButton && this.isComposing && this.chatInputEl) {
    // IMEの確定を待つため、短い遅延を入れる
    setTimeout(() => {
      this.sendChatMessageInternal();
    }, 50);
    return;
  }
  this.sendChatMessageInternal();
}

private sendChatMessageInternal() {
  // 入力フィールドから直接値を取得（ngModelより確実）
  const text = (this.chatInputEl?.nativeElement.value || this.chatInputText).trim();
  if (!text) return;
  const sent = this.shopChatService.sendMessage(text);
  if (sent) {
    this.chatInputText = '';
    if (this.chatInputEl) {
      this.chatInputEl.nativeElement.value = '';
    }
  }
}
```

**HTML** ([game.component.html](../../frontend/src/app/pages/game/game.component.html))

```html
<button class="chat-send-btn" (click)="sendChatMessage(true)">送信</button>
```

## 修正後の動作

### Enterキー送信

- **日本語変換中**: Enterキーを押しても送信されず、変換が確定される
- **変換確定後**: もう一度Enterキーを押すとメッセージが送信される
- **英数字入力**: 従来通りEnterキーで即座に送信される

### 送信ボタン

- **日本語変換中**: ボタンをクリックすると、未変換文字も含めて即座に確定・送信される
- **通常入力**: 従来通り即座に送信される

## 技術的な詳細

### IME Compositionイベント

| イベント | 発火タイミング | 用途 |
|---------|--------------|------|
| `compositionstart` | IME変換が開始された時 | 変換中フラグをtrueに設定 |
| `compositionupdate` | 変換候補が更新された時 | （今回は使用しない） |
| `compositionend` | IME変換が確定された時 | 変換中フラグをfalseに設定 |

### 送信ボタンクリック時の遅延（50ms）

IMEの確定処理は非同期で行われるため、ボタンクリック時にIME変換中だった場合は短い遅延を入れることで、確定後の値を確実に取得できるようにしている。

### ViewChildによる直接参照

`[(ngModel)]`の双方向バインディングだけでは、IME確定のタイミングによっては最新の値が反映されないケースがあるため、`@ViewChild`で入力要素を直接参照し、`nativeElement.value`から値を取得することでより確実に最新の入力値を送信できるようにした。

## テスト方法

### 動作確認環境

- iOS Safari（iPhone）
- Android Chrome
- デスクトップ各種ブラウザ

### 確認項目

1. **日本語入力 + Enterキー**
   - [ ] 変換中にEnterキーを押しても送信されない
   - [ ] 変換確定後にEnterキーを押すと送信される

2. **日本語入力 + 送信ボタン**
   - [ ] 変換中に送信ボタンをタップすると未変換文字も含めて送信される

3. **英数字入力 + Enterキー**
   - [ ] Enterキーで即座に送信される

4. **英数字入力 + 送信ボタン**
   - [ ] 送信ボタンで即座に送信される

## 影響範囲

### 変更ファイル

- `frontend/src/app/pages/game/game.component.ts`
- `frontend/src/app/pages/game/game.component.html`

### 影響する機能

- 店舗チャット機能の入力・送信処理のみ

### 破壊的変更

なし（既存の動作を維持しつつ、IME対応を追加）

## 参考資料

- [MDN - Composition Events](https://developer.mozilla.org/en-US/docs/Web/API/CompositionEvent)
- [IME入力を考慮したEnterキー処理のベストプラクティス](https://qiita.com/ledsun/items/31e43a97413dd3c8e38e)

## 履歴

- 2026-05-09: 初版作成（IME対応修正）
