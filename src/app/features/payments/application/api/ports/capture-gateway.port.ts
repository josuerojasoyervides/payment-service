import type { CaptureResult } from '@app/features/payments/domain/subdomains/payment/entities/capture-result.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CapturePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/capture-payment.request';
import type { Observable } from 'rxjs';

export interface CaptureGatewayPort {
  readonly providerId: PaymentProviderId;
  capture(req: CapturePaymentRequest): Observable<CaptureResult>;
}
