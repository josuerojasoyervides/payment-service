import type { PaymentIntentStatus } from '@payments/domain/models/payment/payment-intent.types';

import type { PaypalOrderStatus } from '../dto/paypal.dto';

export const STATUS_MAP: Record<PaypalOrderStatus, PaymentIntentStatus> = {
  CREATED: 'requires_action',
  SAVED: 'requires_confirmation',
  APPROVED: 'requires_confirmation',
  VOIDED: 'canceled',
  COMPLETED: 'succeeded',
  PAYER_ACTION_REQUIRED: 'requires_action',
} as const;
