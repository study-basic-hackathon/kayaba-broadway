import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, filter, Observable, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenRefreshService } from '../services/tokenRefresh.service';

const NOT_APPLICABLE_REDIRECT = ['/auth/refresh', '/auth/login', '/auth/logout'];

/**
 * 認証インターセプター
 *
 * すべてのHTTPリクエストに対して以下の処理を行う。
 *
 * 1. 認証不要なエンドポイント（ログインなど）はそのままスルー
 * 2. アクセストークンが存在する場合、Authorizationヘッダーに付与してリクエストを送信
 * 3. 401エラーが返った場合、トークンのリフレッシュを試みてリクエストをリトライ
 *    - リフレッシュ中の場合: リフレッシュ完了を待機してリトライ
 *    - リフレッシュ未実施の場合: リフレッシュを開始してリトライ
 * 4. リフレッシュが失敗した場合はログイン画面へリダイレクト
 */

export function authInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tokenRefresh = inject(TokenRefreshService);

  // ログイン処理などはアクセストークンの付与やリダイレクトを行わない
  if (NOT_APPLICABLE_REDIRECT.some((x) => req.url.includes(x))) {
    return next(req);
  }

  const accessToken = auth.getAccessToken();
  const reqWithToken = accessToken
    ? req.clone({
        headers: req.headers.set('Authorization', `Bearer ${accessToken}`),
      })
    : req;

  return next(reqWithToken).pipe(
    catchError((error: HttpErrorResponse) => {
      // 認証エラー以外のエラーはそのままエラーとして返す
      if (error.status !== 401) {
        return throwError(() => error);
      }

      // トークンリフレッシュリクエスト中の場合
      if (tokenRefresh.isCurrentlyRefreshing()) {
        return tokenRefresh.getRefreshToken$().pipe(
          filter((token) => token !== null),
          take(1),
          switchMap((token) => {
            const newReq = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${token}`),
            });
            return next(newReq);
          }),
        );
      }

      // トークンリフレッシュ中でない場合の処理
      tokenRefresh.startRefreshing();
      return auth.refresh().pipe(
        switchMap((res) => {
          tokenRefresh.completeRefreshing(res.accessToken);
          auth.setAccessToken(res.accessToken);
          const newReq = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${res.accessToken}`),
          });
          return next(newReq);
        }),
        catchError((refreshError) => {
          // トークンリフレッシュが失敗した場合、ログイン画面に遷移
          tokenRefresh.failRefreshing();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
}
