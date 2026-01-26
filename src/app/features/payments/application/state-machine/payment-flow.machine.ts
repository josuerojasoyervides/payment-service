import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { assign, fromPromise, setup } from 'xstate';

import { normalizePaymentError } from '../store/payment-store.errors';
import { PaymentFlowDeps } from './payment-flow.deps';
import { isFinalStatus, needsUserAction } from './payment-flow.policy';
import {
  CancelInput,
  ConfirmInput,
  PaymentFlowEvent,
  PaymentFlowMachineContext,
  StartInput,
  StatusInput,
} from './payment-flow.types';

export const createPaymentFlowMachine = (deps: PaymentFlowDeps) =>
  setup({
    types: {} as {
      context: PaymentFlowMachineContext;
      events: PaymentFlowEvent;
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
    },

    actions: {
      setStartInput: assign(({ event }) => {
        if (event.type !== 'START') return {};

        return {
          providerId: event.providerId,
          request: event.request,
          flowContext: event.flowContext ?? null,
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
        };
      }),

      setRefreshInput: assign(({ event, context }) => {
        if (event.type !== 'REFRESH') return {};

        return {
          providerId: event.providerId ?? context.providerId,
          intentId: event.intentId ?? context.intentId ?? context.intent?.id ?? null,
          error: null,
        };
      }),

      setConfirmInput: assign(({ event }) => {
        if (event.type !== 'CONFIRM') return {};

        return {
          providerId: event.providerId,
          intentId: event.intentId,
          intent: null,
          error: null,
        };
      }),

      setCancelInput: assign(({ event }) => {
        if (event.type !== 'CANCEL') return {};

        return {
          providerId: event.providerId,
          intentId: event.intentId,
          intent: null,
          error: null,
        };
      }),

      setIntent: assign(({ event }) => {
        if (!('output' in event)) return {};
        return {
          intent: event.output,
          intentId: event.output.id,
          error: null,
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
      })),
    },

    guards: {
      hasIntent: ({ context }) => !!context.intent,
      needsUserAction: ({ context }) => needsUserAction(context.intent),
      isFinal: ({ context }) => isFinalStatus(context.intent?.status),
      hasRefreshKeys: ({ context }) =>
        !!context.providerId && !!(context.intentId ?? context.intent?.id),
      canFallback: ({ context }) =>
        context.fallback.eligible &&
        !!context.fallback.request &&
        !!context.fallback.failedProviderId,
    },
  }).createMachine({
    id: 'paymentFlow',
    initial: 'idle',

    on: {
      RESET: { target: '.idle', actions: 'clear' },
    },

    context: () => ({
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
    }),

    states: {
      idle: {
        tags: ['idle'],
        on: {
          START: { target: 'starting', actions: 'setStartInput' },
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
          CONFIRM: { target: 'confirming', actions: 'setConfirmInput' },
          CANCEL: { target: 'cancelling', actions: 'setCancelInput' },
        },
      },

      starting: {
        tags: ['loading', 'starting'],
        invoke: {
          src: 'start',
          input: ({ context }) => ({
            providerId: context.providerId!,
            request: context.request!,
            flowContext: context.flowContext ?? undefined,
          }),
          onDone: { target: 'afterStart', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      afterStart: {
        tags: ['loading', 'afterStart'],
        always: [
          { guard: 'needsUserAction', target: 'requiresAction' },
          { guard: 'isFinal', target: 'done' },
          { target: 'polling' },
        ],
      },

      requiresAction: {
        tags: ['ready', 'requiresAction'],
        on: {
          CONFIRM: { target: 'confirming', actions: 'setConfirmInput' },
          CANCEL: { target: 'cancelling', actions: 'setCancelInput' },
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
        },
      },

      confirming: {
        tags: ['loading', 'confirming'],
        invoke: {
          src: 'confirm',
          input: ({ context, event }) => {
            if (event.type === 'CONFIRM') {
              return {
                providerId: event.providerId,
                intentId: event.intentId,
                returnUrl: event.returnUrl,
              };
            }

            return {
              providerId: context.providerId!,
              intentId: context.intentId ?? context.intent!.id,
              returnUrl: context.flowContext?.returnUrl,
            };
          },
          onDone: { target: 'afterConfirm', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      afterConfirm: {
        tags: ['loading', 'afterConfirm'],
        always: [
          { guard: 'needsUserAction', target: 'requiresAction' },
          { guard: 'isFinal', target: 'done' },
          { target: 'polling' },
        ],
      },

      polling: {
        tags: ['ready', 'polling'],
        on: {
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
          CANCEL: { target: 'cancelling' },
        },
      },

      fetchingStatus: {
        tags: ['loading', 'fetchingStatus'],
        always: [
          {
            guard: 'hasRefreshKeys',
            target: 'fetchingStatusInvoke',
          },
          {
            // si falta providerId/intentId, es bug del caller
            target: 'failed',
            actions: 'setRefreshError',
          },
        ],
      },

      fetchingStatusInvoke: {
        tags: ['loading', 'fetchingStatusInvoke'],
        invoke: {
          src: 'status',
          input: ({ context }) => ({
            providerId: context.providerId!,
            intentId: context.intentId ?? context.intent!.id,
          }),
          onDone: { target: 'afterStatus', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      afterStatus: {
        tags: ['ready', 'afterStatus'],
        always: [
          { guard: 'needsUserAction', target: 'requiresAction' },
          { guard: 'isFinal', target: 'done' },
          { target: 'polling' },
        ],
      },

      cancelling: {
        tags: ['loading', 'cancelling'],
        invoke: {
          src: 'cancel',
          input: ({ context, event }) => {
            if (event.type === 'CANCEL') {
              return { providerId: event.providerId, intentId: event.intentId };
            }

            return {
              providerId: context.providerId!,
              intentId: context.intentId ?? context.intent!.id,
            };
          },
          onDone: { target: 'done', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      failed: {
        tags: ['error', 'failed'],
        always: [{ guard: 'canFallback', target: 'fallbackCandidate' }],
        on: {
          RESET: { target: 'idle', actions: 'clear' },
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
          FALLBACK_REQUESTED: {
            target: 'fallbackCandidate',
            actions: 'setFallbackRequested',
          },
          FALLBACK_EXECUTE: { target: 'starting', actions: 'setFallbackStartInput' },
        },
      },

      fallbackCandidate: {
        tags: ['ready', 'fallbackCandidate', 'fallback'],
        on: {
          RESET: { target: 'idle', actions: 'clear' },
          FALLBACK_EXECUTE: { target: 'starting', actions: 'setFallbackStartInput' },
          FALLBACK_ABORT: { target: 'done', actions: 'clear' },
        },
      },

      done: {
        tags: ['ready', 'done'],
        on: {
          RESET: { target: 'idle', actions: 'clear' },
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
        },
      },
    },
  });
