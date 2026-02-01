import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { NextActionClientConfirm } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
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
