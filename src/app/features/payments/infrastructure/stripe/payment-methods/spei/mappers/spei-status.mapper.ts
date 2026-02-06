import type { PaymentIntentStatus } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';

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
