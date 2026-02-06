import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { VoidPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/void-payment.request';
import type { Observable } from 'rxjs';

export interface VoidGatewayPort {
  readonly providerId: PaymentProviderId;
  void(req: VoidPaymentRequest): Observable<void>;
}
