import type { PaymentIntentStatus } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaypalOrderStatus } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { match } from 'ts-pattern';

export function mapPaypalOrderStatus(status: PaypalOrderStatus): PaymentIntentStatus {
  return match(status)
    .returnType<PaymentIntentStatus>()
    .with('CREATED', () => 'requires_action')
    .with('SAVED', () => 'requires_confirmation')
    .with('APPROVED', () => 'requires_confirmation')
    .with('VOIDED', () => 'canceled')
    .with('COMPLETED', () => 'succeeded')
    .with('PAYER_ACTION_REQUIRED', () => 'requires_action')
    .otherwise(() => 'processing');
}
