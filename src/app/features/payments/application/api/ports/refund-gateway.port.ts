import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { RefundResult } from '@app/features/payments/domain/subdomains/payment/entities/refund-result.model';
import type { RefundPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/refund-payment.request';
import type { Observable } from 'rxjs';

export interface RefundGatewayPort {
  readonly providerId: PaymentProviderId;
  refund(req: RefundPaymentRequest): Observable<RefundResult>;
}
