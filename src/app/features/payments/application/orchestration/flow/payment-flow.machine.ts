import {
  createFlowContext,
  mergeExternalReference,
  resolveStatusReference,
  updateFlowContextProviderRefs,
} from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
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
import { startStates } from '@payments/application/orchestration/flow/payment-flow/stages/payment-flow-start.stage';
import {
  isPaymentError,
  normalizePaymentError,
} from '@payments/application/orchestration/store/projection/payment-store.errors';
import { createPaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.factory';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { assign, fromPromise, setup } from 'xstate';

export const createPaymentFlowMachine = (
  deps: PaymentFlowDeps,
  configOverrides: PaymentFlowConfigOverrides = {},
  initialContext?: Partial<PaymentFlowMachineContext>,
) => {
  const config = resolvePaymentFlowConfig(configOverrides);

  return setup({
    types: {} as {
      context: PaymentFlowMachineContext;
      events: PaymentFlowEvent;
    },

    delays: {
      pollDelay: ({ context }) => getPollingDelayMs(config, context.polling.attempt),
      statusRetryDelay: ({ context }) => getStatusRetryDelayMs(config, context.statusRetry.count),
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

    actions: {
      noop: () => undefined,
      setStartInput: assign(({ event }) => {
        if (event.type !== 'START') return {};

        const flowContext = createFlowContext({
          providerId: event.providerId,
          request: event.request,
          existing: event.flowContext ?? null,
        });

        return {
          providerId: event.providerId,
          request: event.request,
          flowContext,
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
          polling: { attempt: 0 },
          statusRetry: { count: 0 },
        };
      }),

      setRefreshInput: assign(({ event, context }) => {
        if (event.type !== 'REFRESH') return {};

        const providerId = event.providerId ?? context.providerId;
        const resolvedReference = resolveStatusReference(context.flowContext, providerId ?? null);

        return {
          providerId,
          intentId:
            event.intentId ?? resolvedReference ?? context.intentId ?? context.intent?.id ?? null,
          error: null,
          statusRetry: { count: 0 },
        };
      }),

      setExternalEventInput: assign(({ event, context }) => {
        if (
          event.type !== 'REDIRECT_RETURNED' &&
          event.type !== 'EXTERNAL_STATUS_UPDATED' &&
          event.type !== 'WEBHOOK_RECEIVED'
        )
          return {};

        const referenceId = event.payload.referenceId ?? '';
        const merged = referenceId
          ? mergeExternalReference({
              context: context.flowContext,
              providerId: event.payload.providerId,
              referenceId,
            })
          : null;
        const flowContext: PaymentFlowMachineContext['flowContext'] =
          merged ??
          (referenceId
            ? {
                providerId: event.payload.providerId,
                providerRefs: {
                  [event.payload.providerId]: { paymentId: referenceId },
                },
              }
            : context.flowContext);

        const resolvedReference = resolveStatusReference(flowContext, event.payload.providerId);

        return {
          providerId: event.payload.providerId,
          intentId:
            event.payload.referenceId ??
            resolvedReference ??
            context.intentId ??
            context.intent?.id ??
            null,
          flowContext,
          error: null,
          statusRetry: { count: 0 },
        };
      }),

      setConfirmInput: assign(({ event }) => {
        if (event.type !== 'CONFIRM') return {};

        return {
          providerId: event.providerId,
          intentId: event.intentId,
          intent: null,
          error: null,
          statusRetry: { count: 0 },
        };
      }),

      setCancelInput: assign(({ event }) => {
        if (event.type !== 'CANCEL') return {};

        return {
          providerId: event.providerId,
          intentId: event.intentId,
          intent: null,
          error: null,
          statusRetry: { count: 0 },
        };
      }),

      setIntent: assign(({ event, context }) => {
        if (!('output' in event)) return {};

        const providerRefs = event.output.providerRefs ?? { intentId: event.output.id };
        const flowContext = updateFlowContextProviderRefs({
          context: context.flowContext,
          providerId: event.output.provider,
          refs: providerRefs,
        });

        const resolvedIntentId = providerRefs?.intentId ?? event.output.id;
        return {
          intent: event.output,
          intentId: resolvedIntentId,
          flowContext,
          error: null,
          polling: { attempt: 0 },
          statusRetry: { count: 0 },
        };
      }),

      setError: assign(({ event }) => {
        if (!('error' in event)) return {};
        return {
          intent: null,
          error: normalizePaymentError(event.error),
        };
      }),

      setRefreshError: assign(({ context }) => {
        const missing = [
          !context.providerId ? 'providerId' : null,
          !(context.intentId ?? context.intent?.id) ? 'intentId' : null,
        ].filter(Boolean);

        return {
          error: normalizePaymentError(new Error(`Missing ${missing.join(' & ')} for REFRESH`)),
        };
      }),

      setExternalEventError: assign(({ context }) => {
        const missing = [
          !context.providerId ? 'providerId' : null,
          !(context.intentId ?? context.intent?.id) ? 'referenceId' : null,
        ].filter(Boolean);

        return {
          error: normalizePaymentError(
            new Error(`Missing ${missing.join(' & ')} for external event reconciliation`),
          ),
        };
      }),

      setFallbackRequested: assign(({ event }) => {
        if (event.type !== 'FALLBACK_REQUESTED') return {};

        return {
          error: null,
          fallback: {
            eligible: true,
            mode: event.mode ?? 'manual',
            failedProviderId: event.failedProviderId,
            request: event.request,
            selectedProviderId: null,
          },
        };
      }),

      setFallbackStartInput: assign(({ event, context }) => {
        if (event.type !== 'FALLBACK_EXECUTE') return {};

        return {
          providerId: event.providerId,
          request: event.request,
          intent: null,
          intentId: null,
          error: null,
          fallback: {
            ...context.fallback,
            eligible: true,
            request: event.request,
            failedProviderId: event.failedProviderId ?? context.fallback.failedProviderId,
            selectedProviderId: event.providerId,
          },
        };
      }),

      clear: assign(() => ({
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
        polling: { attempt: 0 },
        statusRetry: { count: 0 },
      })),

      incrementPollAttempt: assign(({ context }) => ({
        polling: {
          attempt: Math.min(context.polling.attempt + 1, config.polling.maxAttempts),
        },
      })),

      incrementStatusRetry: assign(({ context }) => ({
        statusRetry: {
          count: Math.min(context.statusRetry.count + 1, config.statusRetry.maxRetries),
        },
      })),

      clearError: assign(() => ({ error: null })),

      setReturnCorrelationError: assign(({ event, context }) => {
        if (event.type !== 'REDIRECT_RETURNED') return {};
        const storedRef = resolveStatusReference(context.flowContext, event.payload.providerId);
        const receivedId = event.payload.referenceId ?? '';
        return {
          error: createPaymentError(
            'return_correlation_mismatch',
            'errors.return_correlation_mismatch',
            { expectedId: storedRef ?? '', receivedId },
            null,
          ),
        };
      }),

      markReturnProcessed: assign(({ event, context }) => {
        if (event.type !== 'REDIRECT_RETURNED') return {};
        const refId = event.payload.referenceId ?? '';
        const flowContext = context.flowContext
          ? {
              ...context.flowContext,
              // Keep both for backwards compatibility; lastReturnNonce is the primary
              // dedupe key, lastReturnReferenceId remains as an audit hint.
              lastReturnNonce: context.flowContext.lastReturnNonce ?? refId,
              lastReturnReferenceId: refId,
              lastReturnAt: Date.now(),
            }
          : null;
        return { flowContext };
      }),

      setProcessingTimeoutError: assign(({ context }) => {
        const flowId = context.flowContext?.flowId ?? null;
        return {
          intent: null,
          error: createPaymentError(
            'processing_timeout',
            'errors.processing_timeout',
            {
              ...(flowId ? { flowId } : {}),
              attempt: context.polling.attempt,
              maxAttempts: config.polling.maxAttempts,
            },
            null,
          ),
        };
      }),

      markExternalEventProcessed: assign(({ event, context }) => {
        if (event.type !== 'EXTERNAL_STATUS_UPDATED' && event.type !== 'WEBHOOK_RECEIVED')
          return {};

        const eventId = (event.payload as { eventId?: string }).eventId;
        if (!eventId) return {};

        const flowContext = context.flowContext
          ? {
              ...context.flowContext,
              lastExternalEventId: eventId,
            }
          : null;

        return { flowContext };
      }),
    },

    guards: {
      hasIntent: ({ context }) => hasIntentPolicy(context),
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
  }).createMachine({
    id: 'paymentFlow',
    initial: 'idle',

    on: {
      RESET: { target: '.idle', actions: 'clear' },
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
      ...doneStates,
    },
  });
};
