# D1 マイグレーション手順

Cloudflare D1（SQLite）のマイグレーション手順を記載します。

---

## ローカル環境へのマイグレーション

**1. Cloudflare にログインする**

```bash
npx wrangler login
```

ブラウザが開くので、Cloudflare アカウントで認証する。

**2. マイグレーションを適用する**

```bash
npx wrangler d1 migrations apply kayaba-broadway --local
```

- `.wrangler/state/v3/d1/` 配下のローカル SQLite ファイルに適用される
- リモート（Cloudflare 上の本番 DB）には一切影響しない
- 未適用のファイルのみ順番に実行される（適用済みはスキップ）
- シーダー（`0001_seeder.sql`）も適用されるため、初期データが自動で投入される

### マイグレーションファイルの場所

```
drizzle/
├── 0000_wild_mentor.sql   # テーブル定義（初回）
└── 0001_seeder.sql        # 初期データ投入
```

- `0000_wild_mentor.sql`: `users`, `fields`, `shops`, `products`, `purchases`, `refresh_tokens` テーブルの作成
- `0001_seeder.sql`: 開発・テスト用の初期データ（ユーザー5件、フィールド・ショップ・商品・購入履歴）

**3. （任意）適用状況を確認する**

```bash
npx wrangler d1 migrations list kayaba-broadway --local
```

もしくは

- `.wrangler/state/v3/d1/***.sqlite`ファイルを開き、テーブルやレコードが存在することを確認してください。

---

## リモート環境へのマイグレーション

> **本番 DB に直接影響します。実行前にマイグレーションファイルの内容を必ず確認してください。**

**1. Cloudflare にログインする**

```bash
npx wrangler login
```

チームの Cloudflare アカウント（または招待済みメンバー）でログインすること。

**2. マイグレーションを適用する**

```bash
npx wrangler d1 migrations apply kayaba-broadway --remote
```

コマンドは [wrangler.jsonc](../wrangler.jsonc) の `database_id` をもとに、Cloudflare 上の D1 インスタンスを特定して実行される。

```jsonc
// wrangler.jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "kayaba-broadway",
    "database_id": "xxxxx",  // この ID でリモート DB を特定
    "migrations_dir": "drizzle"
  }
]
```

**3. （任意）適用状況を確認する**

```bash
npx wrangler d1 migrations list kayaba-broadway --remote
```
