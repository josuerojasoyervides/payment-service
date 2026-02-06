import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { Observable } from 'rxjs';

export interface FinalizeRequest {
  providerId: PaymentProviderId;
  context: PaymentFlowContext;
}

export interface FinalizePort {
  readonly providerId: PaymentProviderId;
  execute(request: FinalizeRequest): Observable<PaymentIntent>;
}
