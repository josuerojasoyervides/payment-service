import { Observable } from 'rxjs';

import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '../../domain/models/payment/payment-request.types';

export interface PaymentGateway {
  readonly providerId: PaymentProviderId;
  createIntent(req: CreatePaymentRequest): Observable<PaymentIntent>;
  confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent>;
  cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent>;
  getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent>;
}

export interface PaymentGatewayRefactor<TRequest, TResponse> {
  execute(request: TRequest): Observable<TResponse>;
}
