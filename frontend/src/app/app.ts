import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxSonnerToaster } from 'ngx-sonner';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgxSonnerToaster],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  protected readonly title = signal('frontend');

  private visibilityChangeHandler = async () => {
    // ページが再表示されたときに認証を確認（スリープ復帰時の対策）
    if (document.visibilityState === 'visible') {
      try {
        await this.auth.ensureValidToken();
      } catch {
        // エラーは握りつぶす（interceptorでハンドリング）
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
