# システムフロー図

フロントエンド・バックエンド・Partykit 間の処理フローをまとめたドキュメント。

> LiveKit（通話）・決済サービスは後から追記予定。

---

## 全体フロー

```mermaid
sequenceDiagram
    actor User
    participant FE as フロントエンド<br>(Angular + PixiJS)
    participant BE as バックエンド<br>(Hono / CF Workers)
    participant PK as Partykit<br>(WebSocket)

    %% ─── 1. 認証 ───────────────────────────────────────
    Note over FE,BE: 1. 認証

    User->>FE: メールアドレス・パスワード入力
    FE->>BE: POST /auth/login
    BE-->>FE: accessToken, refreshToken
    FE->>FE: トークンをローカルに保存

    %% ─── 2. フィールド読み込み ──────────────────────────
    Note over FE,BE: 2. フィールド読み込み

    FE->>BE: GET /fields（認証ヘッダー付き）
    BE-->>FE: フィールド一覧（id, name, background_url, width, height）
    FE->>FE: 先頭フィールドを選択
    FE->>FE: background_url の画像を<br>PixiJS 背景スプライトとして描画

    FE->>BE: GET /fields/:id/shops
    BE-->>FE: 店舗一覧（id, name, position_x, position_y）
    FE->>FE: フィールド上に店舗オブジェクトを配置

    %% ─── 3. リアルタイム接続（Partykit）────────────────
    Note over FE,PK: 3. リアルタイム接続

    FE->>PK: WebSocket 接続（フィールドIDをルームIDとして使用）
    PK-->>FE: 接続確立・既存ユーザー位置を受信
    FE->>FE: 他ユーザーのキャラクターをフィールド上に表示

    %% ─── 4. キャラクター移動 ────────────────────────────
    Note over FE,PK: 4. キャラクター移動

    loop 移動するたびに
        User->>FE: 矢印キー入力
        FE->>FE: 自キャラクター位置を更新
        FE->>PK: 位置情報を送信（userId, x, y）
        PK-->>FE: 他ユーザー全員へブロードキャスト
        FE->>FE: 他ユーザーのキャラクター位置を更新
    end

    %% ─── 5. 店舗入店・商品閲覧 ─────────────────────────
    Note over FE,BE: 5. 店舗入店・商品閲覧

    User->>FE: 店舗エリアに接触（入店）
    FE->>BE: GET /shops/:id/products
    BE-->>FE: 商品一覧（id, name, price, thumbnail_url）
    FE->>FE: 商品一覧ポップアップを表示

    User->>FE: 商品を選択
    FE->>BE: GET /products/:id
    BE-->>FE: 商品詳細（name, description, price, thumbnail_url）
    FE->>FE: 商品詳細ポップアップを表示

    %% ─── 6. 購入・ダウンロード ──────────────────────────
    Note over FE,BE: 6. 購入・ダウンロード（モック決済）

    User->>FE: 購入ボタンを押す
    FE->>BE: POST /products/:id/purchase
    BE-->>FE: 購入完了（purchaseId, payment_status: "mock"）
    FE->>FE: 購入完了メッセージを表示

    User->>FE: ダウンロードボタンを押す
    FE->>BE: GET /purchases/:id/download
    BE-->>FE: ダウンロードURL（R2 署名付きURL）
    FE->>User: ファイルダウンロード開始
```

---

## 補足

| フロー | 備考 |
| ------ | ---- |
| 認証 | `accessToken` の有効期限が切れた場合、`POST /auth/refresh` で再発行する（フロー省略） |
| フィールド読み込み | 現時点では `/fields` の先頭1件を固定で使用。将来的にはロビー画面でユーザーが選択 |
| Partykit ルーム | フィールドIDをルームIDとして使うことで、将来複数フィールドに対応できる |
| 背景画像 | 現在はローカルの仮パス。R2 整備後は `background_url` を R2 URL に差し替えるだけでOK |
| 決済 | 現在はモック（購入ボタン押下で即完了）。Stripe 等への差し替えは `POST /products/:id/purchase` 内部の実装変更のみで対応予定 |
