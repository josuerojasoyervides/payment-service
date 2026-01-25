import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
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

export type ActorId = 'start' | 'confirm' | 'cancel' | 'status';

export interface DoneEvent<TActor extends ActorId, TOutput> {
  type: `xstate.done.actor.${TActor}`;
  output: TOutput;
}

export interface ErrorEvent<TActor extends ActorId> {
  type: `xstate.error.actor.${TActor}`;
  error: unknown;
}

/**
 * Dependencias = “lo que el mundo exterior hace”.
 * La máquina NO sabe de Angular, solo llama funciones.
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

export type PaymentFlowEvent =
  | {
      type: 'START';
      providerId: PaymentProviderId;
      request: CreatePaymentRequest;
      flowContext?: PaymentFlowContext;
    }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'REFRESH' }
  | { type: 'RESET' }
  // ✅ Done events
  | DoneEvent<'start', PaymentIntent>
  | DoneEvent<'confirm', PaymentIntent>
  | DoneEvent<'cancel', PaymentIntent>
  | DoneEvent<'status', PaymentIntent>
  // ✅ Error events
  | ErrorEvent<'start'>
  | ErrorEvent<'confirm'>
  | ErrorEvent<'cancel'>
  | ErrorEvent<'status'>;

export interface PaymentFlowMachineContext {
  providerId: PaymentProviderId | null;
  request: CreatePaymentRequest | null;
  flowContext: PaymentFlowContext | null;

  intent: PaymentIntent | null;
  error: PaymentError | null;
}

export interface StartInput {
  providerId: PaymentProviderId;
  request: CreatePaymentRequest;
  flowContext?: PaymentFlowContext;
}

export interface ConfirmInput {
  providerId: PaymentProviderId;
  intentId: string;
  returnUrl?: string;
}

export interface CancelInput {
  providerId: PaymentProviderId;
  intentId: string;
}

export interface StatusInput {
  providerId: PaymentProviderId;
  intentId: string;
}
