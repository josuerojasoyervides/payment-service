import type { StripePaymentIntentStatus } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import type { PaymentIntentStatus } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

export const STATUS_MAP: Record<StripePaymentIntentStatus, PaymentIntentStatus> = {
  requires_payment_method: 'requires_payment_method',
  requires_confirmation: 'requires_confirmation',
  requires_action: 'requires_action',
  processing: 'processing',
  requires_capture: 'processing',
  canceled: 'canceled',
  succeeded: 'succeeded',
} as const;
