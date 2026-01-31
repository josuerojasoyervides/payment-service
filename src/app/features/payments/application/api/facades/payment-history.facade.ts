import { inject, Injectable } from '@angular/core';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

// TODO : Check what this facade is used for and if it's still needed
@Injectable({ providedIn: 'root' })
export class PaymentHistoryFacade {
  private readonly state = inject(PAYMENT_STATE);

  readonly history = this.state.history;
  readonly historyCount = this.state.historyCount;
  readonly isLoading = this.state.isLoading;

  confirmPayment(intentId: string, provider: PaymentProviderId): void {
    this.state.confirmPayment({ intentId }, provider);
  }

  cancelPayment(intentId: string, provider: PaymentProviderId): void {
    this.state.cancelPayment({ intentId }, provider);
  }

  refreshPayment(intentId: string, provider: PaymentProviderId): void {
    this.state.refreshPayment({ intentId }, provider);
  }

  clearHistory(): void {
    this.state.clearHistory();
  }
}
