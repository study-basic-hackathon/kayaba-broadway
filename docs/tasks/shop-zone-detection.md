# タスク: 店舗ゾーン判定・店舗名オーバーレイ表示

## 概要

`/game` 画面でプレイヤーが店舗エリアに入ったことを検知し、画面右上に店舗名を表示する。

---

## 現状の実装確認

### マップ構造（`map.json`）

- タイルマップは 28×23 タイル（1タイル = 16px × 拡大倍率4 = 64px）
- レイヤー構成:
  | レイヤー名 | 用途 |
  |---|---|
  | `ground` | 地面・建物の床など（描画） |
  | `object` | 家具・装飾など（描画） |
  | `collision` | 当たり判定（描画なし、tile ID: 1768 が障害物） |

- 現状 `collision` レイヤーのタイルに入ると通行不可になる。店舗エリアを示す専用レイヤーは**存在しない**。

### `game.component.ts` の現状

- `collisionTiles: Set<number>` に `collision` レイヤーのタイルインデックスを格納。
- 毎フレーム `canMove()` でプレイヤーの次の座標が `collisionTiles` に含まれるかチェック。
- 店舗情報（位置・名前）はフロントエンドに一切ロードされていない。

### バックエンドAPI

- `GET /fields/:id/shops` で指定フィールドの店舗一覧（`id`, `name`, `position_x`, `position_y` など）を取得可能。
- ただし `position_x/y` は現在ダミー値（`shops.ts` で `100, 150`）。

---

## 方針

**`shops` テーブルにゾーン定義（タイル座標）を持ち、フィールド入室時に API で取得して判定に使う。**

- ゾーン情報は DB で一元管理するため、店舗を追加・変更する際に `map.json` を触る必要がない
- `position_x/y` は入口座標・ラベル表示用として残す（将来的に削除可能）
- ゾーンはタイル単位（ピクセルではなく）で持つことでマップの拡大倍率変更に強くする

---

## 実装タスク

### フェーズ1: バックエンド — `shops` テーブルにゾーン情報を追加

- [x] `src/db/schema.ts` の `shops` テーブルに以下のカラムを追加する
  - `zone_col: integer` — ゾーン左上のタイル列（0始まり）
  - `zone_row: integer` — ゾーン左上のタイル行（0始まり）
  - `zone_width: integer` — ゾーンの幅（タイル数）
  - `zone_height: integer` — ゾーンの高さ（タイル数）
- [x] `drizzle-kit generate` でマイグレーションファイルを生成する（`drizzle/0002_perpetual_deadpool.sql`）
- [x] `src/data/shops.ts` のシードデータにゾーン情報を追加する
  - 現マップの建物内部は col:10〜16, row:7〜13 → `zone_col: 10, zone_row: 7, zone_width: 7, zone_height: 7`
- [x] `drizzle/0001_seeder.sql` の `shops` INSERT にもゾーン情報を追加する
- [x] `GET /fields/:id/shops` のレスポンスにゾーン情報が含まれることを確認する（Drizzle の select で自動的に含まれるため追加実装不要）
- [x] ローカルDBにマイグレーションを適用する（`npx wrangler d1 migrations apply kayaba-broadway --local`）
- [x] ローカルDBの既存 `shops` レコードにゾーン情報を直接 UPDATE する

> **ローカル環境を構築・更新する場合**
> ```bash
> npx wrangler d1 migrations apply kayaba-broadway --local
> ```
> 未適用のマイグレーションが順番に実行される。ゾーン情報の投入（`0003`）も自動で適用される。

### フェーズ2: フロントエンド — 店舗ゾーン判定

- [x] `game.component.ts` の `ngOnInit` で `GET /fields/:fieldId/shops` を呼び出して店舗一覧を取得する
  - `AuthService` からトークンを取得して `Authorization` ヘッダーをセット
- [x] 取得した店舗情報を `shops: Shop[]` として保持する
- [x] `update()` の毎フレーム処理に現在地のタイル座標を計算し、全店舗のゾーン矩形と交差判定するロジックを追加する
  ```typescript
  const tileX = Math.floor(this.x / (this.tileSize * this.scale));
  const tileY = Math.floor(this.y / (this.tileSize * this.scale));
  const shop = this.shops.find(s =>
    tileX >= s.zone_col && tileX < s.zone_col + s.zone_width &&
    tileY >= s.zone_row && tileY < s.zone_row + s.zone_height
  ) ?? null;
  ```
- [x] 現在いる店舗が変化したときのみ `currentShop` を更新する（毎フレーム更新による再描画コストを避ける）

### フェーズ3: UIオーバーレイ表示（Angular 側）

- [x] `game.component.html` に店舗名オーバーレイ用の HTML 要素を追加する

```html
<!-- 右上に表示するオーバーレイ -->
@if (currentShop) {
  <div class="shop-overlay">
    <span class="shop-name">🏪 {{ currentShop.name }}</span>
  </div>
}
```

- [x] `game.component.scss` でスタイルを追加する

```scss
.wrapper {
  position: relative;
}

.shop-overlay {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  pointer-events: none;
  z-index: 10;
}
```

- [x] `game.component.ts` に `currentShop = signal<Shop | null>(null)` を追加して Angular の変更検知と連携する
  - PixiJS の ticker（Web Worker 的な非 Angular Zone なループ）から Angular の signal を更新するため、`NgZone.run()` で更新

---

## 関連ファイル

| ファイル | 変更内容 |
|---|---|
| `src/db/schema.ts` | `shops` テーブルにゾーン情報カラム追加 |
| `src/data/shops.ts` | シードデータにゾーン情報を追加 |
| `frontend/src/app/pages/game/game.component.ts` | 店舗データ取得・ゾーン判定ロジック追加 |
| `frontend/src/app/pages/game/game.component.html` | 店舗名オーバーレイ要素追加 |
| `frontend/src/app/pages/game/game.component.scss` | オーバーレイスタイル追加 |

---

## 補足: 現マップの店舗建物の位置

`map.json` の `collision` レイヤーを見ると、タイル座標 col:10〜16, row:7〜13 付近に壁が配置されており、これが現在唯一の建物（店舗）と推定される。

入れる内部の範囲: col:10〜16, row:7〜13（幅7タイル × 高さ7タイル）

→ シードデータ: `zone_col: 10, zone_row: 7, zone_width: 7, zone_height: 7`
