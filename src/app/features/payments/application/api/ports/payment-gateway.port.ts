import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { Observable } from 'rxjs';

export interface PaymentGatewayPort {
  readonly providerId: PaymentProviderId;
  createIntent(req: CreatePaymentRequest): Observable<PaymentIntent>;
  confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent>;
  cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent>;
  getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent>;
}
