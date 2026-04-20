# バックエンドAPIエンドポイント一覧（現時点）

## 共通仕様

- Base URL（ローカル）: `http://localhost:8787`
- 認証: `/auth/*` を除く全エンドポイントで `Authorization: Bearer <accessToken>` が必要
- Content-Type: JSON

## エンドポイント一覧

| メソッド | パス                  | 認証 | 概要                                                     |
| -------- | --------------------- | ---- | -------------------------------------------------------- |
| POST     | `/auth/login`         | 不要 | ログインしてアクセストークン・リフレッシュトークンを取得 |
| POST     | `/auth/refresh`       | 不要 | リフレッシュトークンからアクセストークンを再発行         |
| GET      | `/users/me`           | 必要 | ログイン中ユーザー情報を取得                             |
| GET      | `/fields`             | 必要 | フィールド一覧を取得                                     |
| GET      | `/fields/:id`         | 必要 | フィールド詳細を取得（背景画像URLを含む）                |
| GET      | `/fields/:id/shops`   | 必要 | 指定フィールドの店舗一覧を取得                           |
| GET      | `/shops`              | 必要 | 店舗一覧を取得                                           |
| GET      | `/shops/:id`          | 必要 | 店舗詳細を取得                                           |
| GET      | `/shops/:id/products` | 必要 | 指定店舗の商品一覧を取得                                 |
| GET      | `/products/:id`       | 必要 | 商品詳細を取得                                           |

## curl例

### 1. ログイン（トークン取得）

```bash
curl -X POST "http://localhost:8787/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shun@example.com",
    "password": "1234"
  }'
```

### 2. トークン更新

```bash
curl -X POST "http://localhost:8787/auth/refresh" \
  -H "Content-Type: application/json" \
  -H "Cookie: refreshToken=<refreshToken>" \
```

### 3. ログイン中ユーザー取得

```bash
curl -X GET "http://localhost:8787/users/me" \
  -H "Authorization: Bearer <accessToken>"
```

### 4. 店舗一覧取得

```bash
curl -X GET "http://localhost:8787/shops" \
  -H "Authorization: Bearer <accessToken>"
```

### 5. フィールド一覧取得

```bash
curl -X GET "http://localhost:8787/fields" \
  -H "Authorization: Bearer <accessToken>"
```

### 6. フィールド詳細取得

```bash
curl -X GET "http://localhost:8787/fields/field-1" \
  -H "Authorization: Bearer <accessToken>"
```

### 7. フィールド内店舗一覧取得

```bash
curl -X GET "http://localhost:8787/fields/field-1/shops" \
  -H "Authorization: Bearer <accessToken>"
```

### 8. 店舗詳細取得

```bash
curl -X GET "http://localhost:8787/shops/shop-1" \
  -H "Authorization: Bearer <accessToken>"
```

### 9. 店舗内商品一覧取得

```bash
curl -X GET "http://localhost:8787/shops/shop-1/products" \
  -H "Authorization: Bearer <accessToken>"
```

### 10. 商品詳細取得

```bash
curl -X GET "http://localhost:8787/products/product-1" \
  -H "Authorization: Bearer <accessToken>"
```
