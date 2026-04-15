---
name: backend-api
description: 茅場ブロードウェイのバックエンドAPIルート実装ガイド。Hono + Drizzle ORM（Cloudflare Workers）でのルート・テストの作成規約。新しいAPIエンドポイントを追加・実装するときに参照。
---

# バックエンド API 実装ガイド

## 技術スタック

- **フレームワーク**: Hono
- **バリデーション**: Zod + @hono/zod-validator
- **ORM**: Drizzle ORM
- **DB**: Cloudflare D1（SQLite）
- **ストレージ**: Cloudflare R2
- **テスト**: Vitest
- **ランタイム**: Cloudflare Workers

## ディレクトリ構成

```
src/
├── index.ts          # アプリのエントリポイント。ルートのマウント・ミドルウェア設定
├── constants.ts      # 定数（JWT_ALGなど）
├── types.ts          # 共通型定義（Bindings, エンティティ型）
├── data/             # モックデータ（現状はインメモリ。将来D1に移行）
│   └── users.ts
└── routes/
    ├── auth.ts
    ├── users.ts
    └── __tests__/    # テストコードはルートファイルと同階層の__tests__に配置
        └── auth.spec.ts
```

## ルートファイルの実装規約

### 基本構造

```typescript
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { Bindings } from "../types";

const router = new Hono<{ Bindings: Bindings }>();

// スキーマ定義
const createXxxSchema = z.object({
  name: z.string(),
});

// ルート定義
router.get("/", (c) => { ... });
router.post("/", zValidator("json", createXxxSchema), async (c) => { ... });

export default router;
```

### src/index.ts へのルート登録

新しいルートを追加したら、`src/index.ts` に `app.route()` で登録する。

```typescript
import shops from "./routes/shops";
app.route("/shops", shops);
```

JWT認証が不要なパスは `/auth/` のみ。その他のルートはすべてJWT認証ミドルウェアが自動適用される。

そのため、`router.request()` を使うルーター単体テストは **各ルートの入力検証・レスポンス・業務ロジック確認用** と考える。`router.request()` はルーター単体を直接呼ぶため、`src/index.ts` で設定した `app.route()` やJWT認証ミドルウェアの適用有無までは検証できない。

JWT認証の有無を確認したい場合は、**`src/index.ts` 経由でアプリ全体に対してリクエストする統合テスト** を追加すること。少なくとも以下を確認する。

- `Authorization` ヘッダーなし: `401`
- 有効な `Authorization` ヘッダーあり: `200`（またはそのルートの正常系ステータス）

推奨は **両方を書くこと**。ルート単体テストでハンドラ自身の振る舞いを素早く確認し、アプリ統合テストで `src/index.ts` のマウント設定・JWT認証ミドルウェア・共通ミドルウェアの適用を確認する。
### Bindings 型（src/types.ts）

```typescript
export type Bindings = {
  JWT_SECRET: string;
  DB: D1Database;
};
```

環境変数・Cloudflare バインディングはすべて `c.env` 経由でアクセスする。

## テストの実装規約

### 基本構造

```typescript
import { describe, expect, test } from "vitest";
import router from "../<route-file>";

const ENV = { JWT_SECRET: "test-secret" };

// リクエストヘルパー関数を定義して使い回す
function getXxxRequest(id: string) {
  return router.request(`/${id}`, { method: "GET" }, ENV);
}

describe("GET:/xxx", () => {
  test("正常系", async () => {
    const res = await getXxxRequest("1");
    expect(res.status).toBe(200);
    const data = await res.json() as { ... };
    // アサーション
  });

  test("存在しない場合は404", async () => {
    const res = await getXxxRequest("nonexistent");
    const { error } = await res.json() as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("...");
  });
});
```

- テストファイルは `src/routes/__tests__/<route-name>.spec.ts` に配置する
- `router.request()` の第3引数に `ENV` オブジェクトを渡して環境変数を注入する
- describe名は `"メソッド:パス"` 形式（例: `"GET:/shops"`）
- テスト名は日本語で「正常系」「異常系」を明示する
- エラーレスポンスの型は `{ error: string }` で統一する

## データ定義の規約

- 現状はモックデータを `src/data/<entity>.ts` に定義している（将来D1に移行予定）
- エンティティの型は `src/types.ts` に定義する

```typescript
// src/types.ts に追加する例
export type Shop = {
  id: string;
  name: string;
  description: string;
  position_x: number;
  position_y: number;
};
```

## /shops エンドポイント仕様（design-doc.md より）

| メソッド | パス           | 説明             | 認証   |
| -------- | -------------- | ---------------- | ------ |
| GET      | `/shops`       | 店舗一覧取得     | 必要   |
| GET      | `/shops/:id`   | 店舗詳細取得     | 必要   |
| GET      | `/shops/:id/products` | 店舗内商品一覧 | 必要 |

### Shop 型（DB設計より）

```typescript
export type Shop = {
  id: string;         // UUID
  name: string;       // 店舗名
  description: string; // 店舗説明
  position_x: number; // フィールド上のX座標
  position_y: number; // フィールド上のY座標
};
```
