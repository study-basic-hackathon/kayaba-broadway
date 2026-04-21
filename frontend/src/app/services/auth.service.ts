import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  http = inject(HttpClient);

  async login(email: string, password: string) {
    try {
      const obs$ = this.http.post<{ accessToken: string }>(
        'http://localhost:8787/auth/login',
        { email, password },
        { withCredentials: true },
      );

      const res = await firstValueFrom(obs$);
      localStorage.setItem('accessToken', res.accessToken);
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

  async refresh() {
    return this.http.post<{ accessToken: string }>(
      'http://localhost:8787/auth/refresh',
      {},
      { withCredentials: true },
    );
  }
}
