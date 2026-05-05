import { Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { signal } from '@angular/core';

@Component({
  selector: 'app-payment-modal',
  templateUrl: './payment-modal.component.html',
  styleUrl: './payment-modal.component.scss',
})
export class PaymentDialogComponent {
  @ViewChild('paymentElement') paymentElement!: ElementRef;

  isPaymentLoading = input<boolean>(false);
  isComplete = input<boolean>(false);
  paymentError = input<string | null>(null);

  back = output<void>();
  submit = output<void>();

  onBack(): void {
    this.back.emit();
  }

  onSubmit(): void {
    this.submit.emit();
  }
}
