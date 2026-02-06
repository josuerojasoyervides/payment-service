import type {
  ExternalStatusUpdatedPayload,
  RedirectReturnedPayload,
  WebhookReceivedPayload,
} from '@app/features/payments/application/adapters/events/flow/payment-flow.events';
// ✅ IMPORTANT: type-only import to avoid runtime circular dependency
import type { FallbackMode } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-modes.types';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentErrorCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { NextActionClientConfirm } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { createPaymentFlowMachine } from '@payments/application/orchestration/flow/payment-flow.machine';
import type { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import type {
  ActorRefFrom,
  EventObject,
  MetaObject,
  ParameterizedObject,
  ProvidedActor,
  SnapshotFrom,
  StatesConfig,
} from 'xstate';

export type ActorId = 'start' | 'confirm' | 'cancel' | 'status' | 'clientConfirm' | 'finalize';

/**
 * XState actor lifecycle events.
 */
export interface DoneEvent<TActor extends ActorId, TOutput> {
  type: `xstate.done.actor.${TActor}`;
  output: TOutput;
}

export interface ErrorEvent<TActor extends ActorId> {
  type: `xstate.error.actor.${TActor}`;
  error: unknown;
}

/**
 * Commands (public).
 */
export type PaymentFlowCommandEvent =
  | {
      type: 'START';
      providerId: PaymentProviderId;
      request: CreatePaymentRequest;
      flowContext?: PaymentFlowContext;
    }
  | {
      type: 'CONFIRM';
      providerId: PaymentProviderId;
      intentId: PaymentIntentId;
      returnUrl?: string;
    }
  | { type: 'CANCEL'; providerId: PaymentProviderId; intentId: PaymentIntentId }
  | { type: 'REFRESH'; providerId?: PaymentProviderId; intentId?: PaymentIntentId }
  | { type: 'RESET' };

/**
 * System/internal events.
 */
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
  | { type: 'CLIENT_CONFIRM_REQUESTED' }
  | { type: 'CLIENT_CONFIRM_SUCCEEDED' }
  | { type: 'CLIENT_CONFIRM_FAILED' }
  | { type: 'FINALIZE_REQUESTED' }
  | { type: 'FINALIZE_SUCCEEDED' }
  | { type: 'FINALIZE_FAILED' }
  | { type: 'CIRCUIT_OPENED'; providerId: PaymentProviderId; cooldownMs?: number }
  | { type: 'RATE_LIMITED'; providerId: PaymentProviderId; cooldownMs?: number }
  | { type: 'ALL_PROVIDERS_UNAVAILABLE' }
  | { type: 'MANUAL_REVIEW_REQUIRED' }
  | { type: 'REDIRECT_RETURNED'; payload: RedirectReturnedPayload }
  | { type: 'EXTERNAL_STATUS_UPDATED'; payload: ExternalStatusUpdatedPayload }
  | { type: 'WEBHOOK_RECEIVED'; payload: WebhookReceivedPayload };

/**
 * Full event union for the machine.
 */
export type PaymentFlowEvent =
  | PaymentFlowCommandEvent
  | PaymentFlowSystemEvent
  // ✅ Done events (invoke resolve)
  | DoneEvent<'start', PaymentIntent>
  | DoneEvent<'confirm', PaymentIntent>
  | DoneEvent<'cancel', PaymentIntent>
  | DoneEvent<'status', PaymentIntent>
  | DoneEvent<'clientConfirm', PaymentIntent>
  | DoneEvent<'finalize', PaymentIntent>
  // ✅ Error events (invoke reject)
  | ErrorEvent<'start'>
  | ErrorEvent<'confirm'>
  | ErrorEvent<'cancel'>
  | ErrorEvent<'status'>
  | ErrorEvent<'clientConfirm'>
  | ErrorEvent<'finalize'>;

export type PaymentFlowPublicEvent = PaymentFlowCommandEvent;

/**
 * Context.
 */
export interface PaymentFlowFallbackContext {
  eligible: boolean;
  mode: FallbackMode;
  failedProviderId: PaymentProviderId | null;
  request: CreatePaymentRequest | null;
  selectedProviderId: PaymentProviderId | null;
}

export interface PaymentFlowResilienceContext {
  circuitCooldownMs: number | null;
  circuitOpenedAt: number | null;
  rateLimitCooldownMs: number | null;
  rateLimitOpenedAt: number | null;
}

export interface ClientConfirmRetryState {
  count: number;
  lastErrorCode: PaymentErrorCode | null;
}

export interface FinalizeRetryState {
  count: number;
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
  intentId: PaymentIntentId | null;
  error: PaymentError | null;
  fallback: PaymentFlowFallbackContext;
  resilience: PaymentFlowResilienceContext;
  clientConfirmRetry: ClientConfirmRetryState;
  finalizeRetry: FinalizeRetryState;
  polling: PaymentFlowPollingState;
  statusRetry: PaymentFlowStatusRetryState;
}

/**
 * Actor inputs.
 */
export interface StartInput {
  providerId: PaymentProviderId;
  request: CreatePaymentRequest;
  flowContext?: PaymentFlowContext;
}

export interface ConfirmInput {
  providerId: PaymentProviderId;
  intentId: PaymentIntentId;
  returnUrl?: string;
}

export interface CancelInput {
  providerId: PaymentProviderId;
  intentId: PaymentIntentId;
}

export interface StatusInput {
  providerId: PaymentProviderId;
  intentId: PaymentIntentId;
}

export interface ClientConfirmInput {
  providerId: PaymentProviderId;
  flowContext: PaymentFlowContext;
  action: NextActionClientConfirm;
}

export interface FinalizeInput {
  providerId: PaymentProviderId;
  flowContext: PaymentFlowContext;
}

/**
 * XState config types.
 */
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
