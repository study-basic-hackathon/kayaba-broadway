import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface User {
  id: string;
  email: string;
  display_name: string;
  icon_url: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  http = inject(HttpClient);

  private currentUser = signal<User | null>(null);
  user = this.currentUser.asReadonly();

  async initializeUser() {
    try {
      const res = await firstValueFrom(this.refresh());
      this.setAuth(res.accessToken, res.user);
    } catch {
      this.currentUser.set(null);
    }
  }

  async register(display_name: string, email: string, password: string, confirm_password: string) {
    try {
      const obs$ = this.http.post<AuthResponse>(
        `${environment.apiBaseUrl}/auth/register`,
        { display_name, email, password, confirm_password },
        { withCredentials: true },
      );
      const res = await firstValueFrom(obs$);
      this.setAuth(res.accessToken, res.user);
    } catch (e) {
      const error = e as HttpErrorResponse;
      throw new Error(error.error?.error ?? 'アカウント作成に失敗しました');
    }
  }

  async login(email: string, password: string) {
    try {
      const obs$ = this.http.post<AuthResponse>(
        `${environment.apiBaseUrl}/auth/login`,
        { email, password },
        { withCredentials: true },
      );
      const res = await firstValueFrom(obs$);
      this.setAuth(res.accessToken, res.user);
    } catch (e) {
      const error = e as HttpErrorResponse;
      throw new Error(error.error?.error ?? 'ログインに失敗しました');
    }
  }

  async logout() {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBaseUrl}/auth/logout`, {}, { withCredentials: true }),
      );
    } finally {
      localStorage.removeItem('accessToken');
      this.currentUser.set(null);
    }
  }

  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  setAuth(token: string, user: User) {
    localStorage.setItem('accessToken', token);
    this.currentUser.set(user);
  }

  /**
   * localStorage のアクセストークンのペイロードをデコードして返す。
   * auth.user() が null（Safari ITP によるリフレッシュ失敗時など）のフォールバック用。
   */
  getUserFromToken(): Pick<User, 'id' | 'display_name' | 'email'> | undefined {
    const token = this.getAccessToken();
    if (!token) return undefined;
    try {
      const payload = token.split('.')[1];
      // atob() は Latin-1 のみ対応で日本語が文字化けするため
      // Uint8Array → UTF-8 デコードで正しく変換する
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const decoded = JSON.parse(new TextDecoder().decode(bytes));
      if (!decoded.id) return undefined;
      return {
        id: decoded.id as string,
        email: decoded.email as string ?? '',
        display_name: decoded.display_name as string ?? '',
      };
    } catch {
      return undefined;
    }
  }

  getUserIdFromToken(): string | undefined {
    return this.getUserFromToken()?.id;
  }

  refresh() {
    return this.http.post<AuthResponse>(
      `${environment.apiBaseUrl}/auth/refresh`,
      {},
      { withCredentials: true },
    );
  }
}
