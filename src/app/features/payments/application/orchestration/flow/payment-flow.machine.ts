import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { assign, fromPromise, setup } from 'xstate';

import { normalizePaymentError } from '../store/projection/payment-store.errors';
import {
  createFlowContext,
  mergeExternalReference,
  resolveStatusReference,
  updateFlowContextProviderRefs,
} from './payment-flow.context';
import { PaymentFlowDeps } from './payment-flow.deps';
import {
  canFallbackPolicy,
  canPollPolicy,
  canRetryStatusPolicy,
  getPollingDelayMs,
  getStatusRetryDelayMs,
  hasIntentPolicy,
  hasRefreshKeysPolicy,
  isFinalIntentPolicy,
  needsClientConfirmPolicy,
  needsFinalizePolicy,
  needsUserActionPolicy,
  type PaymentFlowConfigOverrides,
  resolvePaymentFlowConfig,
} from './payment-flow.policy';
import {
  CancelInput,
  ClientConfirmInput,
  ConfirmInput,
  FinalizeInput,
  PaymentFlowEvent,
  PaymentFlowMachineContext,
  StartInput,
  StatusInput,
} from './payment-flow.types';
import { cancelStates } from './stages/payment-flow-cancel.stage';
import { clientConfirmStates } from './stages/payment-flow-client-confirm.stage';
import { confirmStates } from './stages/payment-flow-confirm.stage';
import { doneStates } from './stages/payment-flow-done.stage';
import { fallbackStates } from './stages/payment-flow-fallback.stage';
import { finalizeStates } from './stages/payment-flow-finalize.stage';
import { idleStates } from './stages/payment-flow-idle.stage';
import { pollingStates } from './stages/payment-flow-polling.stage';
import { reconcileStates } from './stages/payment-flow-reconcile.stage';
import { startStates } from './stages/payment-flow-start.stage';

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
        const flowContext = referenceId
          ? mergeExternalReference({
              context: context.flowContext,
              providerId: event.payload.providerId,
              referenceId,
            })
          : context.flowContext;

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

        const providerRefs = event.output.providerRefs;
        const flowContext = providerRefs
          ? updateFlowContextProviderRefs({
              context: context.flowContext,
              providerId: event.output.provider,
              refs: providerRefs,
            })
          : context.flowContext;

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
    },
  }).createMachine({
    id: 'paymentFlow',
    initial: 'idle',

    on: {
      RESET: { target: '.idle', actions: 'clear' },
      REDIRECT_RETURNED: { target: '.reconciling', actions: 'setExternalEventInput' },
      EXTERNAL_STATUS_UPDATED: { target: '.reconciling', actions: 'setExternalEventInput' },
      WEBHOOK_RECEIVED: { target: '.reconciling', actions: 'setExternalEventInput' },
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
