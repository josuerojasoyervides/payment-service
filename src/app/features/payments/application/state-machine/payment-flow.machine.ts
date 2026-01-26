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
        };
      }),

      setRefreshInput: assign(({ event }) => {
        if (event.type !== 'REFRESH') return {};

        return {
          providerId: event.providerId,
          intentId: event.intentId,
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

      clear: assign(() => ({
        providerId: null,
        request: null,
        flowContext: null,
        intent: null,
        intentId: null,
        error: null,
      })),
    },

    guards: {
      hasIntent: ({ context }) => !!context.intent,
      needsUserAction: ({ context }) => needsUserAction(context.intent),
      isFinal: ({ context }) => isFinalStatus(context.intent?.status),
      hasRefreshKeys: ({ context }) =>
        !!context.providerId && !!(context.intentId ?? context.intent?.id),
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
    }),

    states: {
      idle: {
        on: {
          START: { target: 'starting', actions: 'setStartInput' },
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
        },
      },

      starting: {
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
        always: [
          { guard: 'needsUserAction', target: 'requiresAction' },
          { guard: 'isFinal', target: 'done' },
          { target: 'polling' },
        ],
      },

      requiresAction: {
        on: {
          CONFIRM: { target: 'confirming' },
          CANCEL: { target: 'cancelling' },
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
        },
      },

      confirming: {
        invoke: {
          src: 'confirm',
          input: ({ context }) => ({
            providerId: context.providerId!,
            intentId: context.intent!.id,
            returnUrl: context.flowContext?.returnUrl,
          }),
          onDone: { target: 'afterConfirm', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      afterConfirm: {
        always: [
          { guard: 'needsUserAction', target: 'requiresAction' },
          { guard: 'isFinal', target: 'done' },
          { target: 'polling' },
        ],
      },

      polling: {
        on: {
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
          CANCEL: { target: 'cancelling' },
        },
      },

      fetchingStatus: {
        always: [
          {
            guard: 'hasRefreshKeys',
            target: 'fetchingStatusInvoke',
          },
          {
            // si falta providerId/intentId, es bug del caller
            target: 'failed',
            actions: assign({
              error: () =>
                normalizePaymentError(new Error('Missing providerId/intentId for REFRESH')),
            }),
          },
        ],
      },

      fetchingStatusInvoke: {
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
        always: [
          { guard: 'needsUserAction', target: 'requiresAction' },
          { guard: 'isFinal', target: 'done' },
          { target: 'polling' },
        ],
      },

      cancelling: {
        invoke: {
          src: 'cancel',
          input: ({ context }) => ({
            providerId: context.providerId!,
            intentId: context.intent!.id,
          }),
          onDone: { target: 'done', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      failed: {
        on: {
          RESET: { target: 'idle', actions: 'clear' },
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
        },
      },

      done: {
        on: {
          RESET: { target: 'idle', actions: 'clear' },
          REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
        },
      },
    },
  });
