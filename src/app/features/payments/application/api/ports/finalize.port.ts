import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { Observable } from 'rxjs';

export interface FinalizeRequest {
  providerId: PaymentProviderId;
  context: PaymentFlowContext;
}

export interface FinalizePort {
  readonly providerId: PaymentProviderId;
  execute(request: FinalizeRequest): Observable<PaymentIntent>;
}
