import type { Money } from '@payments/domain/common/primitives/money/money.vo';
import type { PaymentActionRequest } from '@payments/domain/subdomains/payment/messages/payment-action.request';

export type RefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other';

export interface RefundPaymentRequest extends PaymentActionRequest {
  action: 'refund_full' | 'refund_partial';
  amount?: Money;
  reason?: RefundReason;
}
