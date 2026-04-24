import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TokenRefreshService {
  private isRefreshing = false;
  private refreshToken$ = new BehaviorSubject<string | null>(null);

  startRefreshing() {
    this.isRefreshing = true;
    this.refreshToken$.next(null);
  }

  completeRefreshing(token: string) {
    this.isRefreshing = false;
    this.refreshToken$.next(token);
  }

  failRefreshing() {
    this.isRefreshing = false;
  }

  isCurrentlyRefreshing() {
    return this.isRefreshing;
  }

  getRefreshToken$() {
    return this.refreshToken$.asObservable();
  }
}
