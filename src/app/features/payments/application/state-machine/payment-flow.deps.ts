import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';

/**
 * Dependencias = “lo que el mundo exterior hace”.
 * La máquina NO sabe de Angular, solo llama funciones async.
 */
export interface PaymentFlowDeps {
  startPayment: (
    providerId: PaymentProviderId,
    request: CreatePaymentRequest,
    flowContext?: PaymentFlowContext,
  ) => Promise<PaymentIntent>;

  confirmPayment: (
    providerId: PaymentProviderId,
    request: ConfirmPaymentRequest,
  ) => Promise<PaymentIntent>;

  cancelPayment: (
    providerId: PaymentProviderId,
    request: CancelPaymentRequest,
  ) => Promise<PaymentIntent>;

  getStatus: (
    providerId: PaymentProviderId,
    request: GetPaymentStatusRequest,
  ) => Promise<PaymentIntent>;
}
