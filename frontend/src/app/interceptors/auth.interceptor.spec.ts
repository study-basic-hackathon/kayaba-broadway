import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenRefreshService } from '../services/tokenRefresh.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpTesting: HttpTestingController;
  let authService: {
    getAccessToken: ReturnType<typeof vi.fn>;
    setAccessToken: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = {
      getAccessToken: vi.fn(),
      setAccessToken: vi.fn(),
      refresh: vi.fn(),
    };
    router = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        TokenRefreshService,
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // 不要なリクエストが残っていないかを検証
    httpTesting.verify();
  });

  test('アクセストークンをヘッダーに付与する', () => {
    authService.getAccessToken.mockReturnValue('test-token');

    TestBed.inject(HttpClient).get('/api/test').subscribe();

    const req = httpTesting.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
  });

  test('401エラー時にrefreshを実行してリトライする', () => {
    authService.getAccessToken.mockReturnValue('old-token');
    authService.refresh.mockReturnValue(of({ accessToken: 'new-token' }));

    const result = vi.fn();
    TestBed.inject(HttpClient).get('/api/test').subscribe({
      next: result,
    });

    const req = httpTesting.expectOne('/api/test');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    const retryReq = httpTesting.expectOne('/api/test');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retryReq.flush({ data: 'success' });
    expect(result).toHaveBeenCalledWith({ data: 'success' });
  });

  test('refreshが失敗したらログイン画面にリダイレクト', async () => {
    authService.getAccessToken.mockReturnValue('old-token');
    authService.refresh.mockReturnValue(throwError(() => new Error('refresh failed')));
    TestBed.inject(HttpClient)
      .get('/api/test')
      .subscribe({
        error: () => {
          expect(router.navigate).toHaveBeenCalledWith(['/login']);
        },
      });
    const req = httpTesting.expectOne('/api/test');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  test('NOT_APPLICABLE_REDIRECTのURLはスキップする', () => {
    authService.getAccessToken.mockReturnValue('test-token');

    TestBed.inject(HttpClient)
      .post('/auth/refresh', {})
      .subscribe({
        error: () => {},
      });

    const req = httpTesting.expectOne('/auth/refresh');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(authService.refresh).not.toHaveBeenCalled();
  });
});
