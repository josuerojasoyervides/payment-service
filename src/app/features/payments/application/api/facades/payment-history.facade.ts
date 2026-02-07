import { inject, Injectable } from '@angular/core';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
@Injectable({ providedIn: 'root' })
export class PaymentHistoryFacade {
  private readonly state = inject(PAYMENT_STATE);

  readonly history = this.state.history;
  readonly historyCount = this.state.historyCount;
  readonly isLoading = this.state.isLoading;

  confirmPayment(intentId: string, provider: PaymentProviderId): void {
    const result = PaymentIntentId.from(intentId);
    if (!result.ok) return;
    this.state.confirmPayment({ intentId: result.value }, provider);
  }

  cancelPayment(intentId: string, provider: PaymentProviderId): void {
    const result = PaymentIntentId.from(intentId);
    if (!result.ok) return;
    this.state.cancelPayment({ intentId: result.value }, provider);
  }

  refreshPayment(intentId: string, provider: PaymentProviderId): void {
    const result = PaymentIntentId.from(intentId);
    if (!result.ok) return;
    this.state.refreshPayment({ intentId: result.value }, provider);
  }

  clearHistory(): void {
    this.state.clearHistory();
  }
}
