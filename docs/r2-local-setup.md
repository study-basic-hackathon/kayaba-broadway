# R2 ローカル環境セットアップ手順

Cloudflare R2 のローカル擬似環境のセットアップ手順を記載します。

---

## ローカル環境へのファイルアップロード

**1. Cloudflare にログインする**

```bash
npx wrangler login
```

ブラウザが開くので、Cloudflare アカウントで認証する。

**2. ローカル R2 にファイルをアップロードする**

```bash
npx wrangler r2 object put kayaba-broadway-storage/products/sample-vol1.pdf \
  --file ./src/data/products/sample-vol1.pdf \
  --local
```

- `.wrangler/state/v3/r2/` 配下のローカルストレージに保存される
- リモート（Cloudflare 上の本番 R2）には一切影響しない
- `kayaba-broadway-storage` がバケット名、`products/sample-vol1.pdf` がオブジェクトキー

### ファイルの場所

```
src/
└── data/
    └── products/
        └── sample-vol1.pdf   # アップロード対象ファイル
```

**3. （任意）アップロードできたか確認する**

```bash
npx wrangler r2 object get kayaba-broadway-storage/products/sample-vol1.pdf \
  --local \
  --pipe > downloaded.pdf
```

`downloaded.pdf` が生成されれば成功。

### ローカル R2 の保存場所

```
.wrangler/state/v3/r2/
```

---

**4. ローカルサーバーを起動する**

```bash
npm run dev
```

`--remote` なしで起動することで、ローカルの R2 ストレージに接続される。

---

## リモート環境へのファイルアップロード

> **本番 R2 に直接影響します。実行前にファイルの内容を必ず確認してください。**

**1. Cloudflare にログインする**

```bash
npx wrangler login
```

チームの Cloudflare アカウント（または招待済みメンバー）でログインすること。

**2. リモート R2 にファイルをアップロードする**

```bash
npx wrangler r2 object put kayaba-broadway-storage/products/sample-vol1.pdf \
  --file ./src/data/products/sample-vol1.pdf
```

`--local` を省略することでリモートの R2 バケットに直接アップロードされる。

**3. （任意）アップロードできたか確認する**

Cloudflare ダッシュボード → R2 → `kayaba-broadway-storage` → `products/` フォルダを開き、`sample-vol1.pdf` が存在することを確認する。
