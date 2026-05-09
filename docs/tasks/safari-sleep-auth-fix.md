# タスク: iPhone Safari スリープ復帰時の認証問題修正

## 概要

iPhone の Safari でスリープからしばらく経過して再開すると、ログイン画面に飛ばされる問題への対応。

**⚠️ 重要: 根本原因はクロスオリジンCookieのブロック**

現在の構成:
- フロントエンド: `https://kayaba-broadway-frontend.pages.dev`
- バックエンド: `https://api.kayaba-broadway.workers.dev`

iPhone Safari はデフォルトで**クロスオリジン（異なるドメイン）の `sameSite: 'None'` Cookie をブロック**する。  
本ドキュメントの対策は**暫定的な改善**であり、根本的な解決には**カスタムドメインで同一ドメイン化**が必要。

参考: [Reddit - HTTP only cookies not being set on iPhone](https://www.reddit.com/r/webdevelopment/comments/1oh5hpa/http_only_cookies_not_being_set_on_iphone_after/)

---

## 問題の原因（詳細）

### 🚨 根本原因: クロスオリジンCookieのブロック

**iPhone Safari はクロスオリジンの `sameSite: 'None'` Cookie をデフォルトでブロックする。**

現在の構成では、フロントエンド（`pages.dev`）とバックエンド（`workers.dev`）が異なるドメインのため：

```http
POST /auth/refresh HTTP/1.1
Host: api.kayaba-broadway.workers.dev
Cookie: (空っぽ) ← refreshToken が送信されない
```

結果:
1. リフレッシュリクエストが 401 エラー
2. 何度リトライしても Cookie は送信されない
3. ログイン画面へリダイレクト

**解決策**: カスタムドメインで同一ドメイン化（後述）

---

### 副次的な原因（同一ドメイン化後も考慮すべき）

### 1. Cookie 付与の遅延
- Safari がスリープから復帰する際、`withCredentials: true` での Cookie 送信が間に合わない可能性
- ネットワーク再接続に時間がかかる（数百ms〜1秒以上）

### 2. Safari ITP（Intelligent Tracking Prevention）
- サードパーティ Cookie の制限により、長時間スリープ後に Cookie が無効化される可能性
- `sameSite: 'None'` の Cookie が削除される場合がある

### 3. ネットワークの不安定性
- スリープ復帰直後のネットワーク接続が不安定
- システムリソースの競合により、HTTP リクエストが遅延する

---

## 実装した対策（暫定）

**⚠️ 注意**: 以下の対策は**副次的な原因（遅延・不安定性）には有効**だが、**クロスオリジンCookieブロックには無効**。根本解決には同一ドメイン化が必須。

### 1. リトライロジック（auth.interceptor.ts）

#### 目的
Cookie 付与の遅延を吸収するため、401 エラー時に段階的にリトライする。

#### 実装内容
```typescript
return next(reqWithToken).pipe(
  retry({
    count: 3,
    delay: (error: HttpErrorResponse, retryCount) => {
      // 401エラーの場合のみリトライ（Cookie付与遅延対策）
      // Safari スリープ復帰時のネットワーク再接続を考慮して段階的に延長
      if (error.status === 401) {
        const delays = [200, 500, 1000];
        return timer(delays[retryCount - 1] || 1000);
      }
      throw error;
    },
  }),
  // ...
);
```

#### リトライスケジュール
| リトライ回数 | 待機時間 | 累計待機時間 |
|---|---|---|
| 1回目 | 200ms | 200ms |
| 2回目 | 500ms | 700ms |
| 3回目 | 1000ms | 1700ms |

- **軽度の遅延**: 200ms で回復
- **中程度の遅延**: 500ms 待機後に回復
- **重度の遅延**: 1000ms 待機後に最後のチャンス

#### withCredentials の明示的設定
```typescript
const reqWithToken = accessToken
  ? req.clone({
      headers: req.headers.set('Authorization', `Bearer ${accessToken}`),
      withCredentials: true,
    })
  : req.clone({ withCredentials: true });
```

すべてのリクエストに `withCredentials: true` を設定し、Cookie を確実に送信する。

---

### 2. トークン有効期限チェック（auth.service.ts）

#### 目的
リクエスト前にトークンの有効期限を確認し、期限切れなら事前にリフレッシュする。

#### 実装内容

##### isAccessTokenValid()
```typescript
/**
 * アクセストークンが有効期限内かチェックする
 * @param bufferSeconds 余裕を持たせる秒数（デフォルト: 60秒）
 */
isAccessTokenValid(bufferSeconds = 60): boolean {
  const token = this.getAccessToken();
  if (!token) return false;

  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes));

    if (!decoded.exp) return false;

    const nowUnix = Math.floor(Date.now() / 1000);
    return decoded.exp > nowUnix + bufferSeconds;
  } catch {
    return false;
  }
}
```

JWT ペイロードをデコードして `exp`（有効期限）を確認。60秒の余裕を持たせることで、期限切れ直前のリクエスト失敗を防ぐ。

##### ensureValidToken()
```typescript
/**
 * トークンが期限切れまたは期限切れ間近の場合、リフレッシュする
 */
async ensureValidToken(): Promise<void> {
  if (this.isAccessTokenValid()) {
    return; // トークンが有効ならそのまま
  }

  try {
    const res = await firstValueFrom(this.refresh());
    this.setAuth(res.accessToken, res.user);
  } catch (error) {
    // リフレッシュ失敗時はトークンをクリア
    localStorage.removeItem('accessToken');
    this.currentUser.set(null);
    throw error;
  }
}
```

トークンが無効なら `/auth/refresh` でリフレッシュ。失敗時は localStorage をクリアしてログイン画面へ誘導。

---

### 3. visibilityChange 監視（app.ts）

#### 目的
ページが再表示されたとき（スリープ復帰時）に、トークンの有効期限を確認してリフレッシュする。

#### 実装内容
```typescript
export class App implements OnInit, OnDestroy {
  private auth = inject(AuthService);

  private visibilityChangeHandler = async () => {
    // ページが再表示されたときに認証を確認（スリープ復帰時の対策）
    if (document.visibilityState === 'visible') {
      try {
        await this.auth.ensureValidToken();
      } catch {
        // エラーは握りつぶす（interceptor でハンドリング）
      }
    }
  };

  ngOnInit() {
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  ngOnDestroy() {
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
  }
}
```

`document.visibilityState` が `'visible'` になったタイミングで `ensureValidToken()` を実行。トークンが期限切れなら事前にリフレッシュすることで、後続のリクエストの失敗を防ぐ。

---

## 動作フロー

### 正常系（スリープ復帰 → リクエスト成功）

```
1. スリープから復帰
   ↓
2. visibilitychange イベント発火
   ↓
3. ensureValidToken() でトークン確認
   - 有効なら何もしない
   - 期限切れなら /auth/refresh でリフレッシュ
   ↓
4. 後続のリクエスト（例: /api/fields/1）
   ↓
5. interceptor で Authorization ヘッダー付与 + withCredentials: true
   ↓
6. 成功（200 OK）
```

### Cookie 遅延系（リトライで回復）

```
1. スリープから復帰
   ↓
2. visibilitychange で ensureValidToken() 実行（成功）
   ↓
3. 後続のリクエスト（例: /api/products）
   ↓
4. interceptor で Authorization ヘッダー付与 + withCredentials: true
   ↓
5. バックエンドに到達するも Cookie が付与されていない → 401 エラー
   ↓
6. retry ロジック発動
   - 200ms 待機してリトライ
   ↓
7. リトライリクエスト（Cookie が付与される）
   ↓
8. 成功（200 OK）
```

### リフレッシュ失敗系（ログイン画面へ）

```
1. スリープから復帰（Cookie が削除されている）
   ↓
2. visibilitychange で ensureValidToken() 実行
   ↓
3. /auth/refresh リクエスト → 401 エラー（Cookie なし）
   ↓
4. retry ロジック発動（最大3回リトライ）
   ↓
5. すべてのリトライが失敗
   ↓
6. interceptor の catchError で /login へリダイレクト
```

---

## テスト方法

### iPhone Safari での確認手順

1. ログイン後、ゲーム画面に入る
2. iPhone をスリープさせる（電源ボタンを押す）
3. 5〜10分待機する
4. iPhone を起動してブラウザを再表示する
5. 以下を確認：
   - ログイン画面に飛ばされないこと
   - ゲーム画面がそのまま表示されること
   - API リクエストが正常に動作すること

### デバッグログの確認

開発者ツールのコンソールで以下を確認：

```javascript
// visibilitychange イベントの発火確認
document.addEventListener('visibilitychange', () => {
  console.log('visibilityState:', document.visibilityState);
});

// トークンの有効期限確認
const token = localStorage.getItem('accessToken');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token exp:', new Date(payload.exp * 1000));
console.log('Current time:', new Date());
```

---

## 既知の制限事項

### 🚨 最重要: クロスオリジンCookieのブロック（iPhone Safari）

**現在の構成では、iPhone Safari でリフレッシュトークンが送信されない。**

- フロントエンド: `pages.dev`、バックエンド: `workers.dev` → 異なるドメイン
- iPhone Safari は `sameSite: 'None'` の Cookie をブロック
- リトライ・トークン有効期限チェック・visibilityChange 監視では**解決できない**

**根本的な解決策**: カスタムドメインで同一ドメイン化（後述）

---

### Safari ITP によるCookie削除
- 24時間以上スリープした場合、Safari ITP により `sameSite: 'None'` の Cookie が削除される可能性がある
- この場合、リトライでは回復できず、ログイン画面へリダイレクトされる
- **対策**: リフレッシュトークンの有効期限を7日間に設定しているため、定期的にアクセスすれば問題ない

### ネットワーク切断時
- 機内モードやWi-Fi切断時は、リトライしても回復できない
- **対策**: ネットワークエラー時はユーザーにメッセージを表示する（今後の改善案）

---

## 今後の改善案

### 🎯 最優先: カスタムドメインで同一ドメイン化（根本解決）

**iPhone Safari でのクロスオリジンCookieブロックを解決する唯一の方法。**

#### 実装手順

1. **カスタムドメインの購入**
   - 例: `kayaba-broadway.com`

2. **Cloudflare Workers にカスタムドメイン設定**
   ```bash
   # Cloudflare ダッシュボード → Workers → api.kayaba-broadway.workers.dev → Settings → Domains & Routes
   # カスタムドメインを追加: api.kayaba-broadway.com
   ```

3. **Cloudflare Pages にカスタムドメイン設定**
   ```bash
   # Cloudflare ダッシュボード → Pages → kayaba-broadway-frontend → Custom domains
   # カスタムドメインを追加: kayaba-broadway.com
   ```

4. **環境変数の更新**
   ```typescript
   // frontend/src/environments/environment.production.ts
   export const environment = {
     production: true,
     apiBaseUrl: 'https://api.kayaba-broadway.com', // 変更
     partykitHost: 'kayaba-broadway.yasunariiguchi.partykit.dev',
     stripePublicKey: 'pk_test_...',
   };
   ```

5. **Cookie 設定の変更**
   ```typescript
   // src/routes/auth.ts
   setCookie(c, 'refreshToken', refreshToken, {
     httpOnly: true,
     secure: true,
     sameSite: 'Lax', // 'None' から 'Lax' に変更
     maxAge: REFRESH_TOKEN_EXPIRES_IN,
   });
   ```

6. **CORS 設定の更新**
   ```jsonc
   // wrangler.jsonc
   "vars": {
     "CORS_ORIGIN": "https://kayaba-broadway.com,http://localhost:4200"
   }
   ```

#### 効果
- ✅ iPhone Safari でもCookieが送信される
- ✅ `sameSite: 'Lax'` で十分動作
- ✅ Safari ITP の影響を受けにくい
- ✅ リトライロジックは副次的な遅延対策として引き続き有効

---

### その他の改善案（補助的）

### 1. ネットワーク状態の監視
```typescript
window.addEventListener('online', () => {
  // ネットワーク復帰時に ensureValidToken() を実行
});
```

### 2. オフライン対応
- Service Worker を使ってオフライン時のリクエストをキューイング
- ネットワーク復帰時に自動リトライ

### 3. ユーザーへのフィードバック
- リトライ中は「再接続中...」のローディング表示
- リフレッシュ失敗時は「セッションが切れました。ログインしてください」のメッセージ

---

## 関連ファイル

- `frontend/src/app/interceptors/auth.interceptor.ts` - リトライロジック
- `frontend/src/app/services/auth.service.ts` - トークン有効期限チェック
- `frontend/src/app/app.ts` - visibilityChange 監視
- `src/routes/auth.ts` - バックエンドの認証エンドポイント

---

## まとめ

### 実施した暫定対応

3つの対策を実装し、**ネットワーク遅延・接続不安定性**に対応した：

1. **リトライロジック**: Cookie 付与の遅延を吸収（200ms → 500ms → 1000ms）
2. **トークン有効期限チェック**: 期限切れ前に自動リフレッシュ
3. **visibilityChange 監視**: スリープ復帰時に事前確認

### ⚠️ 残された根本課題

**iPhone Safari のクロスオリジンCookieブロックには対応できていない。**

- 現在の構成: `pages.dev` ↔ `workers.dev` （異なるドメイン）
- iPhone Safari は `sameSite: 'None'` Cookie をブロック
- リトライしても Cookie は送信されない

### 🎯 次のステップ

**カスタムドメインで同一ドメイン化** することで根本解決する：

```
フロントエンド: https://kayaba-broadway.com
バックエンド:   https://api.kayaba-broadway.com
↓
同じドメイン（kayaba-broadway.com）
→ sameSite: 'Lax' で動作
→ iPhone でも Cookie が送信される
```

それまでは、**暫定対応によりネットワーク遅延には対応できている**が、**iPhone Safari では引き続きログイン画面に飛ばされる可能性がある**。