import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { ActorRefFrom, SnapshotFrom } from 'xstate';

// ✅ IMPORTANT: type-only import to avoid runtime circular dependency
import type { createPaymentFlowMachine } from './payment-flow.machine';

export type ActorId = 'start' | 'confirm' | 'cancel' | 'status';

export interface DoneEvent<TActor extends ActorId, TOutput> {
  type: `xstate.done.actor.${TActor}`;
  output: TOutput;
}

export interface ErrorEvent<TActor extends ActorId> {
  type: `xstate.error.actor.${TActor}`;
  error: unknown;
}

export type PaymentFlowEvent =
  | {
      type: 'START';
      providerId: PaymentProviderId;
      request: CreatePaymentRequest;
      flowContext?: PaymentFlowContext;
    }
  | { type: 'CONFIRM'; providerId: PaymentProviderId; intentId: string; returnUrl?: string }
  | { type: 'CANCEL'; providerId: PaymentProviderId; intentId: string }
  | { type: 'REFRESH'; providerId: PaymentProviderId; intentId: string }
  | { type: 'RESET' }
  // ✅ Done events (invoke resolve)
  | DoneEvent<'start', PaymentIntent>
  | DoneEvent<'confirm', PaymentIntent>
  | DoneEvent<'cancel', PaymentIntent>
  | DoneEvent<'status', PaymentIntent>
  // ✅ Error events (invoke reject)
  | ErrorEvent<'start'>
  | ErrorEvent<'confirm'>
  | ErrorEvent<'cancel'>
  | ErrorEvent<'status'>;

export type PaymentFlowPublicEvent = Extract<
  PaymentFlowEvent,
  { type: 'START' | 'CONFIRM' | 'CANCEL' | 'REFRESH' | 'RESET' }
>;

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

/**
 * Convenience exports
 */
export type PaymentFlowMachine = ReturnType<typeof createPaymentFlowMachine>;
export type PaymentFlowSnapshot = SnapshotFrom<PaymentFlowMachine>;
export type PaymentFlowActorRef = ActorRefFrom<PaymentFlowMachine>;
