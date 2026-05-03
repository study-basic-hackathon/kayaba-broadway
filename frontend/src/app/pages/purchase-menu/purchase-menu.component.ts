import { Component, computed, signal, output, inject, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Product {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price: number;
  file_url: string;
  thumbnail_url: string;
  created_at: number;
}

interface ProductsResponse {
  products: Product[];
}

@Component({
  selector: 'app-purchase-menu',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './purchase-menu.component.html',
  styleUrl: './purchase-menu.component.scss',
})
export class PurchaseMenuComponent {
  closed = output<void>();
  private http = inject(HttpClient);

  products = signal<Product[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  totalPrice = computed(() => this.products().reduce((sum, p) => sum + p.price, 0));

  ngOnInit() {
    const shopId = 'a1b2c3d4-0001-0000-0000-000000000001';

    this.http.get<ProductsResponse>(`http://localhost:8787/shops/${shopId}/products`).subscribe({
      next: (data) => {
        this.products.set([data.products[0]]);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('商品の取得に失敗しました');
        this.isLoading.set(false);
      },
    });
  }

  close() {
    this.closed.emit();
  }

  async onPurchase() {
    const purchaseProductIds = this.products().map(({ id }) => ({
      id,
      quantity: 1,
    }));

    this.http
      .post(
        'http://localhost:8787/payment/checkout',
        {
          field_id: 'f1e2d3c4-0001-0000-0000-000000000001',
          items: purchaseProductIds,
        },
        { headers: { 'Content-Type': 'application/json' } },
      )
      .subscribe({
        next: (res: any) => {
          if (res.url) {
            window.location.href = res.url;
          }
        },
        error: () => alert('ダウンロードに失敗しました'),
      });

    // const key = 'sample-vol1.pdf';
    //   this.http
    //     .get(`http://localhost:8787/purchase/download/${key}`, {
    //       responseType: 'blob',
    //     })
    //     .subscribe({
    //       next: (blob) => {
    //         const url = URL.createObjectURL(blob);
    //         const a = document.createElement('a');
    //         a.href = url;
    //         a.download = key;
    //         a.click();
    //         URL.revokeObjectURL(url);
    //       },
    //       error: () => alert('ダウンロードに失敗しました'),
    //     });
  }
}
