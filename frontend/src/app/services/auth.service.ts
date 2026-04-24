import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  http = inject(HttpClient);

  async register(display_name: string, email: string, password: string, confirm_password: string) {
    try {
      const obs$ = this.http.post<{ accessToken: string }>(
        'http://localhost:8787/auth/register',
        { display_name, email, password, confirm_password },
        { withCredentials: true },
      );
      const res = await firstValueFrom(obs$);
      this.setAccessToken(res.accessToken);
    } catch (e) {
      const error = e as HttpErrorResponse;
      throw new Error(error.error?.error ?? 'アカウント作成に失敗しました');
    }
  }

  async login(email: string, password: string) {
    try {
      const obs$ = this.http.post<{ accessToken: string }>(
        'http://localhost:8787/auth/login',
        { email, password },
        { withCredentials: true },
      );
      const res = await firstValueFrom(obs$);
      this.setAccessToken(res.accessToken);
    } catch (e) {
      const error = e as HttpErrorResponse;
      throw new Error(error.error?.error ?? 'ログインに失敗しました');
    }
  }

  logout() {
    localStorage.removeItem('accessToken');
  }

  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  setAccessToken(token: string) {
    localStorage.setItem('accessToken', token);
  }

  refresh() {
    return this.http.post<{ accessToken: string }>(
      'http://localhost:8787/auth/refresh',
      {},
      { withCredentials: true },
    );
  }
}
