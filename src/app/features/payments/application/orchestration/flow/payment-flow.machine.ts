import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { createPaymentFlowActions } from '@payments/application/orchestration/flow/payment-flow/actions/payment-flow.actions';
import { resolveStatusReference } from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
import type { PaymentFlowDeps } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.deps';
import type {
  CancelInput,
  ClientConfirmInput,
  ConfirmInput,
  FinalizeInput,
  PaymentFlowEvent,
  PaymentFlowMachineContext,
  StartInput,
  StatusInput,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import {
  canFallbackPolicy,
  canPollPolicy,
  canRetryStatusPolicy,
  getPollingDelayMs,
  getStatusRetryDelayMs,
  hasIntentPolicy,
  hasProcessingTimedOutPolicy,
  hasRefreshKeysPolicy,
  isFinalIntentPolicy,
  isPollingExhaustedPolicy,
  needsClientConfirmPolicy,
  needsFinalizePolicy,
  needsUserActionPolicy,
  type PaymentFlowConfig,
  type PaymentFlowConfigOverrides,
  resolvePaymentFlowConfig,
} from '@payments/application/orchestration/flow/payment-flow/policy/payment-flow.policy';
import { cancelStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-cancel.stage';
import { clientConfirmStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-client-confirm.stage';
import { confirmStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-confirm.stage';
import { doneStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-done.stage';
import { fallbackStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-fallback.stage';
import { finalizeStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-finalize.stage';
import { idleStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-idle.stage';
import { pollingStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-polling.stage';
import { reconcileStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-reconcile.stage';
import { resilienceStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-resilience.stage';
import { startStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-start.stage';
import { isPaymentError } from '@payments/application/orchestration/store/projection/payment-store.errors';
import { fromPromise, setup } from 'xstate';

const DEFAULT_CIRCUIT_COOLDOWN_MS = 30_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 15_000;
const CLIENT_CONFIRM_RETRY_DELAY_MS = 500;
const FINALIZE_RETRY_DELAY_MS = 1000;
const MAX_CLIENT_CONFIRM_RETRIES = 1;
const MAX_FINALIZE_RETRIES = 5;

const createPaymentFlowSetup = (deps: PaymentFlowDeps, config: PaymentFlowConfig) => {
  const machineSetup = setup({
    types: {} as {
      context: PaymentFlowMachineContext;
      events: PaymentFlowEvent;
    },

    delays: {
      pollDelay: ({ context }) => getPollingDelayMs(config, context.polling.attempt),
      statusRetryDelay: ({ context }) => getStatusRetryDelayMs(config, context.statusRetry.count),
      circuitCooldown: ({ context }) =>
        context.resilience.circuitCooldownMs ?? DEFAULT_CIRCUIT_COOLDOWN_MS,
      rateLimitCooldown: ({ context }) =>
        context.resilience.rateLimitCooldownMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS,
      clientConfirmRetryDelay: () => CLIENT_CONFIRM_RETRY_DELAY_MS,
      finalizeRetryDelay: () => FINALIZE_RETRY_DELAY_MS,
    },

    actors: {
      start: fromPromise<PaymentIntent, StartInput>(async ({ input }) => {
        return deps.startPayment(input.providerId, input.request, input.flowContext);
      }),

      confirm: fromPromise<PaymentIntent, ConfirmInput>(async ({ input }) => {
        return deps.confirmPayment(input.providerId, {
          intentId: input.intentId,
          returnUrl: input.returnUrl,
        });
      }),

      cancel: fromPromise<PaymentIntent, CancelInput>(async ({ input }) => {
        return deps.cancelPayment(input.providerId, { intentId: input.intentId });
      }),

      status: fromPromise<PaymentIntent, StatusInput>(async ({ input }) => {
        return deps.getStatus(input.providerId, { intentId: input.intentId });
      }),

      clientConfirm: fromPromise<PaymentIntent, ClientConfirmInput>(async ({ input }) => {
        return deps.clientConfirm({
          providerId: input.providerId,
          action: input.action,
          context: input.flowContext,
        });
      }),

      finalize: fromPromise<PaymentIntent, FinalizeInput>(async ({ input }) => {
        return deps.finalize({
          providerId: input.providerId,
          context: input.flowContext,
        });
      }),
    },

    guards: {
      hasIntent: ({ context }) => hasIntentPolicy(context),
      canStart: ({ context }) => !context.request && !context.intent && !context.intentId,
      needsUserAction: ({ context }) => needsUserActionPolicy(context),
      needsClientConfirm: ({ context }) => needsClientConfirmPolicy(context),
      needsFinalize: ({ context }) => needsFinalizePolicy(context),
      isFinal: ({ context }) => isFinalIntentPolicy(context),
      hasRefreshKeys: ({ context }) => hasRefreshKeysPolicy(context),
      canFallback: ({ context }) => canFallbackPolicy(context),
      canPoll: ({ context }) => canPollPolicy(config, context),
      canRetryStatus: ({ context }) => canRetryStatusPolicy(config, context),
      isUnsupportedFinalizeError: ({ event }) => {
        const e = (event as { error?: unknown }).error;
        return isPaymentError(e) && e.code === 'unsupported_finalize';
      },
      isCircuitOpenError: ({ event }) => {
        const e = (event as { error?: unknown }).error;
        return isPaymentError(e) && e.code === 'circuit_open';
      },
      isRateLimitedError: ({ event }) => {
        const e = (event as { error?: unknown }).error;
        return isPaymentError(e) && e.code === 'rate_limited';
      },
      shouldRetryClientConfirm: ({ context, event }) => {
        const e = (event as { error?: unknown }).error;
        return (
          isPaymentError(e) &&
          e.code === 'timeout' &&
          context.clientConfirmRetry.count < MAX_CLIENT_CONFIRM_RETRIES
        );
      },
      canRetryFinalize: ({ context }) => context.finalizeRetry.count < MAX_FINALIZE_RETRIES,
      hasPendingRequest: ({ context }) => !!(context.providerId && context.request),
      isReturnCorrelationMismatch: ({ event, context }) => {
        if (event.type !== 'REDIRECT_RETURNED') return false;
        const storedRef = resolveStatusReference(context.flowContext, event.payload.providerId);
        const receivedId = event.payload.referenceId ?? '';
        return storedRef != null && storedRef !== '' && storedRef !== receivedId;
      },
      isDuplicateReturn: ({ event, context }) => {
        if (event.type !== 'REDIRECT_RETURNED') return false;
        const refId = event.payload.referenceId ?? '';
        const lastNonce =
          context.flowContext?.lastReturnNonce ?? context.flowContext?.lastReturnReferenceId;
        return !!lastNonce && lastNonce === refId;
      },
      isDuplicateExternalEvent: ({ event, context }) => {
        if (event.type !== 'EXTERNAL_STATUS_UPDATED' && event.type !== 'WEBHOOK_RECEIVED')
          return false;
        const eventId = (event.payload as { eventId?: string }).eventId;
        if (!eventId) return false;
        return context.flowContext?.lastExternalEventId === eventId;
      },
      isProcessingTimedOut: ({ context }) => {
        return hasProcessingTimedOutPolicy(config, context);
      },
      isPollingExhausted: ({ context }) => {
        return isPollingExhaustedPolicy(config, context);
      },
    },
  });

  const actions = createPaymentFlowActions(machineSetup.assign, config);
  return machineSetup.extend({ actions });
};

/**
 * Builds the payment flow XState machine with injected deps and config.
 */
export const createPaymentFlowMachine = (
  deps: PaymentFlowDeps,
  configOverrides: PaymentFlowConfigOverrides = {},
  initialContext?: Partial<PaymentFlowMachineContext>,
) => {
  const config = resolvePaymentFlowConfig(configOverrides);
  const machineSetup = createPaymentFlowSetup(deps, config);

  return machineSetup.createMachine({
    id: 'paymentFlow',
    initial: 'idle',

    on: {
      RESET: { target: '.idle', actions: 'clear' },
      CIRCUIT_OPENED: { target: '.circuitOpen', actions: 'setCircuitOpen' },
      RATE_LIMITED: { target: '.rateLimited', actions: 'setRateLimited' },
      ALL_PROVIDERS_UNAVAILABLE: { target: '.allProvidersUnavailable', actions: 'clearError' },
      MANUAL_REVIEW_REQUIRED: { target: '.pendingManualReview', actions: 'clearError' },
      REDIRECT_RETURNED: [
        {
          guard: 'isReturnCorrelationMismatch',
          target: '.failed',
          actions: 'setReturnCorrelationError',
        },
        {
          guard: 'isDuplicateReturn',
          // Duplicate returns are treated as no-ops; keep the current state.
          actions: 'noop',
        },
        {
          target: '.finalizing',
          actions: ['setExternalEventInput', 'markReturnProcessed'],
        },
      ],
      EXTERNAL_STATUS_UPDATED: [
        {
          guard: 'isDuplicateExternalEvent',
          actions: 'noop',
        },
        {
          target: '.reconciling',
          actions: ['setExternalEventInput', 'markExternalEventProcessed'],
        },
      ],
      WEBHOOK_RECEIVED: [
        {
          guard: 'isDuplicateExternalEvent',
          actions: 'noop',
        },
        {
          target: '.reconciling',
          actions: ['setExternalEventInput', 'markExternalEventProcessed'],
        },
      ],
    },

    context: () => {
      const base: PaymentFlowMachineContext = {
        providerId: null,
        request: null,
        flowContext: null,
        intent: null,
        intentId: null,
        error: null,
        fallback: {
          eligible: false,
          mode: 'manual',
          failedProviderId: null,
          request: null,
          selectedProviderId: null,
        },
        resilience: {
          circuitCooldownMs: DEFAULT_CIRCUIT_COOLDOWN_MS,
          circuitOpenedAt: null,
          rateLimitCooldownMs: DEFAULT_RATE_LIMIT_COOLDOWN_MS,
          rateLimitOpenedAt: null,
        },
        clientConfirmRetry: { count: 0, lastErrorCode: null },
        finalizeRetry: { count: 0 },
        polling: { attempt: 0 },
        statusRetry: { count: 0 },
      };

      return { ...base, ...(initialContext ?? {}) };
    },

    states: {
      ...idleStates,
      ...startStates,
      ...confirmStates,
      ...clientConfirmStates,
      ...finalizeStates,
      ...pollingStates,
      ...reconcileStates,
      ...cancelStates,
      ...fallbackStates,
      ...resilienceStates,
      ...doneStates,
    },
  });
};
