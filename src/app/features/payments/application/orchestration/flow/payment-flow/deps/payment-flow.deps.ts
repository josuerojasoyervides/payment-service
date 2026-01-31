import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ClientConfirmRequest } from '@payments/application/api/ports/client-confirm.port';
import type { FinalizeRequest } from '@payments/application/api/ports/finalize.port';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/subdomains/payment/contracts/payment-request.command';

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

export type ClientConfirm = (request: ClientConfirmRequest) => Promise<PaymentIntent>;

export type Finalize = (request: FinalizeRequest) => Promise<PaymentIntent>;

/**
 * Dependencies = \"what the outside world does\".
 * The machine knows nothing about Angular; it only calls async functions.
 */
export interface PaymentFlowDeps {
  startPayment: StartPayment;
  confirmPayment: ConfirmPayment;
  cancelPayment: CancelPayment;
  getStatus: GetStatus;
  clientConfirm: ClientConfirm;
  finalize: Finalize;
}
