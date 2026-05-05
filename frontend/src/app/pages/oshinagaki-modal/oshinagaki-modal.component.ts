import { Component, ElementRef, inject, input, output, signal, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  file_url: string;
}

@Component({
  selector: 'app-oshinagaki-modal',
  templateUrl: './oshinagaki-modal.component.html',
  styleUrl: './oshinagaki-modal.component.scss',
})
export class OshinagakiModalComponent {
  @ViewChild('paymentElement') paymentElementRef!: ElementRef;
  private http = inject(HttpClient);
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  menuItems = input.required<Product[]>();

  products = signal<Product[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isPaymentStep = signal(false);
  isPaymentLoading = signal(false);
  isComplete = signal(false);
  paymentError = signal<string | null>(null);

  close = output<void>();
  buy = output<string>();

  async ngOnInit() {
    this.stripe = await loadStripe(
      'pk_test_51TR8Yd1lp8GZIfDzFSJrRBkJZJMpPDP1n333ba4BYUdcJ61e3IszQbtEbSv5bqwX1RH4g2KXUS0NjnBmfydwWAkF00SyIUjiMA',
    );
  }

  onClose(): void {
    this.close.emit();
  }

  onBack(): void {
    this.isPaymentStep.set(false);
    this.isComplete.set(false);
    this.paymentError.set(null);
  }

  async onSubmit(): Promise<void> {
    if (!this.stripe || !this.elements) return;
    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });
    if (error) {
      this.paymentError.set(error.message ?? 'エラーが発生しました');
    } else {
      this.isComplete.set(true);
      setTimeout(() => {
        this.isPaymentStep.set(false);
        this.isComplete.set(false);
        this.paymentError.set(null);
        this.elements = null;
      }, 2000);
    }
  }

  onBuy(id: string) {
    this.isPaymentStep.set(true);
    this.isPaymentLoading.set(true);

    this.http
      .post<{
        clientSecret: string;
        customerSessionClientSecret: string;
      }>('http://localhost:8787/payment/create-payment-intent', { amount: 500 })
      .subscribe({
        next: async ({ clientSecret, customerSessionClientSecret }) => {
          if (!this.stripe) return;

          this.elements = this.stripe.elements({
            clientSecret,
            customerSessionClientSecret,
          });
          const paymentElement = this.elements.create('payment');
          this.isPaymentLoading.set(false);
          setTimeout(() => {
            paymentElement.mount(this.paymentElementRef.nativeElement);
          });
        },
        error: () => {
          this.paymentError.set('読み込みに失敗しました');
          this.isPaymentLoading.set(false);
        },
      });
  }
}
