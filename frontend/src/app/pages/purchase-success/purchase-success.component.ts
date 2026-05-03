import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface PurchasedProduct {
  id: string;
  name: string;
  price: number;
  file_url: string;
}

interface SuccessResponse {
  success: boolean;
  products: PurchasedProduct[];
  field_id: string;
}

@Component({
  selector: 'app-purchase-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-success.component.html',
  styleUrl: './purchase-success.component.scss',
})
export class PurchaseSuccessComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  isLoading = signal(true);
  isDownloading = signal(false);
  error = signal<string | null>(null);
  products = signal<PurchasedProduct[]>([]);
  fieldId = signal<string | null>(null);

  ngOnInit() {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');

    if (!sessionId) {
      this.error.set('セッションIDが見つかりません');
      this.isLoading.set(false);
      return;
    }

    this.http
      .get<SuccessResponse>(`http://localhost:8787/payment/success?session_id=${sessionId}`)
      .subscribe({
        next: (res) => {
          this.products.set(res.products);
          this.fieldId.set(res.field_id);
          this.isLoading.set(false);
          this.downloadAll(res.products);
        },
        error: () => {
          this.error.set('決済の確認に失敗しました');
          this.isLoading.set(false);
        },
      });
  }

  downloadAll(products: PurchasedProduct[]) {
    this.isDownloading.set(true);
    products.forEach((product) => {
      this.http
        .get(`http://localhost:8787/purchase/download/${product.file_url}`, {
          responseType: 'blob',
        })
        .subscribe({
          next: (blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = product.name + '.pdf';
            a.click();
            URL.revokeObjectURL(url);
          },
          error: () => alert(`${product.name}のダウンロードに失敗しました`),
        });
    });
    this.isDownloading.set(false);
  }

  goToGame() {
    const fieldId = this.fieldId();
    if (!fieldId) return;
    this.router.navigate(['/game', fieldId]);
  }
}
