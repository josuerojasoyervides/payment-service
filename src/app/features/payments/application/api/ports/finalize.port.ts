import type { PaymentFlowContext } from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { Observable } from 'rxjs';

export interface FinalizeRequest {
  providerId: PaymentProviderId;
  context: PaymentFlowContext;
}

export interface FinalizePort {
  readonly providerId: PaymentProviderId;
  execute(request: FinalizeRequest): Observable<PaymentIntent>;
}
