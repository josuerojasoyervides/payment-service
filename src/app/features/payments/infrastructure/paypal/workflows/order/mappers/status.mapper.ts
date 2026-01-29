import type { PaypalOrderStatus } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import type { PaymentIntentStatus } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

export const STATUS_MAP: Record<PaypalOrderStatus, PaymentIntentStatus> = {
  CREATED: 'requires_action',
  SAVED: 'requires_confirmation',
  APPROVED: 'requires_confirmation',
  VOIDED: 'canceled',
  COMPLETED: 'succeeded',
  PAYER_ACTION_REQUIRED: 'requires_action',
} as const;
