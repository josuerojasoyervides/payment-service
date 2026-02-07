import type { PaymentIntentStatus } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { match } from 'ts-pattern';

export class SpeiStatusMapper {
  mapSpeiStatus(status: StripeSpeiSourceDto['status']): PaymentIntentStatus {
    return match(status)
      .returnType<PaymentIntentStatus>()
      .with('pending', () => 'requires_action')
      .with('chargeable', () => 'requires_confirmation')
      .with('consumed', () => 'succeeded')
      .with('canceled', () => 'canceled')
      .with('failed', () => 'failed')
      .otherwise(() => 'processing');
  }
}
