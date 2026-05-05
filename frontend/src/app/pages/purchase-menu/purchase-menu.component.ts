import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';

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
  @ViewChild('paymentElement') paymentElementRef!: ElementRef;

  closed = output<void>();
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;

  products = signal<Product[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isPaymentStep = signal(false);
  isPaymentLoading = signal(false);
  isComplete = signal(false);
  paymentError = signal<string | null>(null);

  totalPrice = computed(() => this.products().reduce((sum, p) => sum + p.price, 0));

  async ngOnInit() {
    this.stripe = await loadStripe(
      'pk_test_51TR8Yd1lp8GZIfDzFSJrRBkJZJMpPDP1n333ba4BYUdcJ61e3IszQbtEbSv5bqwX1RH4g2KXUS0NjnBmfydwWAkF00SyIUjiMA',
    );

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
    this.isPaymentStep.set(true);
    this.isPaymentLoading.set(true);
    this.cdr.detectChanges();

    this.http
      .post<{
        clientSecret: string;
        customerSessionClientSecret: string;
      }>('http://localhost:8787/payment/create-payment-intent', { amount: this.totalPrice() })
      .subscribe({
        next: async ({ clientSecret, customerSessionClientSecret }) => {
          if (!this.stripe) return;

          this.elements = this.stripe.elements({
            clientSecret,
            customerSessionClientSecret,
          });
          const paymentElement = this.elements.create('payment');
          this.isPaymentLoading.set(false);
          this.cdr.detectChanges();
          paymentElement.mount(this.paymentElementRef.nativeElement);
        },
        error: () => {
          this.paymentError.set('読み込みに失敗しました');
          this.isPaymentLoading.set(false);
        },
      });
  }

  async onSubmit() {
    if (!this.stripe || !this.elements) return;
    this.isPaymentLoading.set(true);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: { return_url: 'https://example.com/complete' },
      redirect: 'if_required',
    });

    if (error) {
      this.paymentError.set(error.message ?? '決済に失敗しました');
      this.isPaymentLoading.set(false);
    } else {
      this.isComplete.set(true);
      this.isPaymentLoading.set(false);
    }
  }

  onBack() {
    this.isPaymentStep.set(false);
    this.paymentError.set(null);
    this.isComplete.set(false);
    this.elements = null;
  }
}
