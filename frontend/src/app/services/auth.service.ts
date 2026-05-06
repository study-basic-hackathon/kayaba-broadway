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

  refresh() {
    return this.http.post<AuthResponse>(
      `${environment.apiBaseUrl}/auth/refresh`,
      {},
      { withCredentials: true },
    );
  }
}
