import type { PaymentActionRequest } from '@payments/domain/subdomains/payment/messages/payment-action.request';

export interface VoidPaymentRequest extends PaymentActionRequest {
  action: 'void' | 'release_authorization';
}
