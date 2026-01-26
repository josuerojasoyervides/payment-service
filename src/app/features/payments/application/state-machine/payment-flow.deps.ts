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

export type StartPayment = (
  providerId: PaymentProviderId,
  request: CreatePaymentRequest,
  flowContext?: PaymentFlowContext,
) => Promise<PaymentIntent>;

export type ConfirmPayment = (
  providerId: PaymentProviderId,
  request: ConfirmPaymentRequest,
) => Promise<PaymentIntent>;

export type CancelPayment = (
  providerId: PaymentProviderId,
  request: CancelPaymentRequest,
) => Promise<PaymentIntent>;

export type GetStatus = (
  providerId: PaymentProviderId,
  request: GetPaymentStatusRequest,
) => Promise<PaymentIntent>;

/**
 * Dependencias = “lo que el mundo exterior hace”.
 * La máquina NO sabe de Angular, solo llama funciones async.
 */
export interface PaymentFlowDeps {
  startPayment: StartPayment;
  confirmPayment: ConfirmPayment;
  cancelPayment: CancelPayment;
  getStatus: GetStatus;
}
