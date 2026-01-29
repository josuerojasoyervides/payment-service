import type { NextActionClientConfirm } from '@payments/domain/subdomains/payment/contracts/payment-action.types';
import type { PaymentFlowContext } from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { Observable } from 'rxjs';

export interface ClientConfirmRequest {
  providerId: PaymentProviderId;
  action: NextActionClientConfirm;
  context: PaymentFlowContext;
}

export interface ClientConfirmPort {
  readonly providerId: PaymentProviderId;
  execute(request: ClientConfirmRequest): Observable<PaymentIntent>;
}
