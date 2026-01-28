import type { PaymentIntentStatus } from '@payments/domain/models/payment/payment-intent.types';
import type { StripePaymentIntentStatus } from '@payments/infrastructure/stripe/dto/stripe.dto';

export const STATUS_MAP: Record<StripePaymentIntentStatus, PaymentIntentStatus> = {
  requires_payment_method: 'requires_payment_method',
  requires_confirmation: 'requires_confirmation',
  requires_action: 'requires_action',
  processing: 'processing',
  requires_capture: 'processing',
  canceled: 'canceled',
  succeeded: 'succeeded',
} as const;
