import { PaymentIntentStatus } from '@payments/domain/models/payment/payment-intent.types';

import { StripeSpeiSourceDto } from '../dto/stripe.dto';

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
