import type { Money } from '@payments/domain/common/primitives/money/money.vo';
import type { PaymentActionRequest } from '@payments/domain/subdomains/payment/messages/payment-action.request';

export interface CapturePaymentRequest extends PaymentActionRequest {
  action: 'capture';
  amount?: Money;
}
