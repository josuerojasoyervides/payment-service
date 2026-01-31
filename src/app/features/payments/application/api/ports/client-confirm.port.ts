import type { NextActionClientConfirm } from '@app/features/payments/domain/subdomains/payment/entities/payment-action.types';
import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
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
