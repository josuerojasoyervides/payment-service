import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { assign, fromPromise, setup } from 'xstate';

import { normalizePaymentError } from '../store/payment-store.errors';
import { isFinalStatus, needsUserAction } from './payment-flow.helpers';
import {
  CancelInput,
  ConfirmInput,
  PaymentFlowDeps,
  PaymentFlowEvent,
  PaymentFlowMachineContext,
  StartInput,
  StatusInput,
} from './payment-flow.types';

/**
 * Máquina “pura”
 */
export const createPaymentFlowMachine = (deps: PaymentFlowDeps) =>
  setup({
    types: {} as {
      context: PaymentFlowMachineContext;
      events: PaymentFlowEvent;
    },

    actors: {
      start: fromPromise<PaymentIntent, StartInput>(async ({ input }: { input: StartInput }) => {
        return deps.startPayment(input.providerId, input.request, input.flowContext);
      }),

      confirm: fromPromise<PaymentIntent, ConfirmInput>(
        async ({ input }: { input: ConfirmInput }) => {
          return deps.confirmPayment(input.providerId, {
            intentId: input.intentId,
            returnUrl: input.returnUrl,
          });
        },
      ),

      cancel: fromPromise<PaymentIntent, CancelInput>(async ({ input }: { input: CancelInput }) => {
        return deps.cancelPayment(input.providerId, { intentId: input.intentId });
      }),

      status: fromPromise<PaymentIntent, StatusInput>(async ({ input }: { input: StatusInput }) => {
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
          error: null,
        };
      }),

      setIntent: assign(({ event }) => {
        if (!('output' in event)) return {};
        return { intent: event.output, error: null };
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
        error: null,
      })),
    },

    guards: {
      hasIntent: ({ context }: { context: PaymentFlowMachineContext }) => !!context.intent,
      needsUserAction: ({ context }: { context: PaymentFlowMachineContext }) =>
        needsUserAction(context.intent),
      isFinal: ({ context }: { context: PaymentFlowMachineContext }) =>
        isFinalStatus(context.intent?.status),
    },
  }).createMachine({
    id: 'paymentFlow',
    initial: 'idle',

    context: () => ({
      providerId: null,
      request: null,
      flowContext: null,
      intent: null,
      error: null,
    }),

    states: {
      idle: {
        on: {
          START: { target: 'starting', actions: 'setStartInput' },
        },
      },

      starting: {
        invoke: {
          src: 'start',
          input: ({ context }: { context: PaymentFlowMachineContext }) => ({
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
        },
      },

      confirming: {
        invoke: {
          src: 'confirm',
          input: ({ context }: { context: PaymentFlowMachineContext }) => ({
            providerId: context.providerId!,
            intentId: context.intent!.id,
            returnUrl: context.flowContext?.returnUrl,
          }),
          onDone: { target: 'afterConfirm', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      afterConfirm: {
        always: [{ guard: 'isFinal', target: 'done' }, { target: 'polling' }],
      },

      polling: {
        on: {
          REFRESH: { target: 'fetchingStatus' },
          CANCEL: { target: 'cancelling' },
        },
      },

      fetchingStatus: {
        invoke: {
          src: 'status',
          input: ({ context }: { context: PaymentFlowMachineContext }) => ({
            providerId: context.providerId!,
            intentId: context.intent!.id,
          }),
          onDone: { target: 'afterStatus', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      afterStatus: {
        always: [{ guard: 'isFinal', target: 'done' }, { target: 'polling' }],
      },

      cancelling: {
        invoke: {
          src: 'cancel',
          input: ({ context }: { context: PaymentFlowMachineContext }) => ({
            providerId: context.providerId!,
            intentId: context.intent!.id,
          }),
          onDone: { target: 'done', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      failed: {
        on: { RESET: { target: 'idle', actions: 'clear' } },
      },

      done: {
        on: { RESET: { target: 'idle', actions: 'clear' } },
      },
    },
  });
