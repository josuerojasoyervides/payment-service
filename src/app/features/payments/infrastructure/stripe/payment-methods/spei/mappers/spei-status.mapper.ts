import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import type { PaymentIntentStatus } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

export class SpeiStatusMapper {
  mapSpeiStatus(status: StripeSpeiSourceDto['status']): PaymentIntentStatus {
    const map: Record<StripeSpeiSourceDto['status'], PaymentIntentStatus> = {
      pending: 'requires_action',
      chargeable: 'requires_confirmation',
      consumed: 'succeeded',
      canceled: 'canceled',
      failed: 'failed',
    };
    return map[status] ?? 'processing';
  }
}
