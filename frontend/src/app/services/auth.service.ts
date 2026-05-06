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
   * localStorage のアクセストークンから userId (sub クレーム) を取り出す。
   * auth.user() が null（リフレッシュ失敗時など）のフォールバック用。
   */
  getUserIdFromToken(): string | undefined {
    const token = this.getAccessToken();
    if (!token) return undefined;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return decoded.sub as string | undefined;
    } catch {
      return undefined;
    }
  }

  refresh() {
    return this.http.post<AuthResponse>(
      `${environment.apiBaseUrl}/auth/refresh`,
      {},
      { withCredentials: true },
    );
  }
}
