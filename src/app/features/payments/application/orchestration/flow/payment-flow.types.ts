import { FallbackMode } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import type {
  ActorRefFrom,
  EventObject,
  MetaObject,
  ParameterizedObject,
  ProvidedActor,
  SnapshotFrom,
  StatesConfig,
} from 'xstate';

import type {
  ExternalStatusUpdatedPayload,
  RedirectReturnedPayload,
  WebhookReceivedPayload,
} from '../../adapters/events/payment-flow.events';
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

export type PaymentFlowCommandEvent =
  | {
      type: 'START';
      providerId: PaymentProviderId;
      request: CreatePaymentRequest;
      flowContext?: PaymentFlowContext;
    }
  | { type: 'CONFIRM'; providerId: PaymentProviderId; intentId: string; returnUrl?: string }
  | { type: 'CANCEL'; providerId: PaymentProviderId; intentId: string }
  | { type: 'REFRESH'; providerId?: PaymentProviderId; intentId?: string }
  | { type: 'RESET' };

export type PaymentFlowSystemEvent =
  | {
      type: 'FALLBACK_REQUESTED';
      failedProviderId: PaymentProviderId;
      request: CreatePaymentRequest;
      mode?: FallbackMode;
    }
  | {
      type: 'FALLBACK_EXECUTE';
      providerId: PaymentProviderId;
      request: CreatePaymentRequest;
      failedProviderId?: PaymentProviderId;
    }
  | { type: 'FALLBACK_ABORT' }
  | { type: 'REDIRECT_RETURNED'; payload: RedirectReturnedPayload }
  | { type: 'EXTERNAL_STATUS_UPDATED'; payload: ExternalStatusUpdatedPayload }
  | { type: 'WEBHOOK_RECEIVED'; payload: WebhookReceivedPayload };

export type PaymentFlowEvent =
  | PaymentFlowCommandEvent
  | PaymentFlowSystemEvent
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

export type PaymentFlowPublicEvent = PaymentFlowCommandEvent;

export interface PaymentFlowFallbackContext {
  eligible: boolean;
  mode: FallbackMode;
  failedProviderId: PaymentProviderId | null;
  request: CreatePaymentRequest | null;
  selectedProviderId: PaymentProviderId | null;
}

export interface PaymentFlowPollingState {
  attempt: number;
}

export interface PaymentFlowStatusRetryState {
  count: number;
}

export interface PaymentFlowMachineContext {
  providerId: PaymentProviderId | null;
  request: CreatePaymentRequest | null;
  flowContext: PaymentFlowContext | null;
  intent: PaymentIntent | null;

  intentId: string | null;
  error: PaymentError | null;
  fallback: PaymentFlowFallbackContext;
  polling: PaymentFlowPollingState;
  statusRetry: PaymentFlowStatusRetryState;
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

export type PaymentFlowStatesConfig = StatesConfig<
  PaymentFlowMachineContext,
  PaymentFlowEvent,
  ProvidedActor,
  ParameterizedObject,
  ParameterizedObject,
  string,
  string,
  unknown,
  EventObject,
  MetaObject
>;

/**
 * Convenience exports
 */
export type PaymentFlowMachine = ReturnType<typeof createPaymentFlowMachine>;
export type PaymentFlowSnapshot = SnapshotFrom<PaymentFlowMachine>;
export type PaymentFlowActorRef = ActorRefFrom<PaymentFlowMachine>;
