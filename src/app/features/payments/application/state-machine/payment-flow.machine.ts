// src/app/features/payments/application/state-machine/payment-flow.machine.ts

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

/**
 * ==========================
 * Machine Factory
 * ==========================
 */

export const createPaymentFlowMachine = (deps: PaymentFlowDeps) =>
  setup({
    types: {} as {
      context: PaymentFlowMachineContext;
      events: PaymentFlowEvent;
    },

    /**
     * Actors = operaciones async (invokes)
     */
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

    /**
     * Actions = mutan context (solo context, nada de side effects externos)
     */
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

    /**
     * Guards = decisiones puras
     */
    guards: {
      hasIntent: ({ context }) => !!context.intent,

      needsUserAction: ({ context }) => needsUserAction(context.intent),

      isFinal: ({ context }) => isFinalStatus(context.intent?.status),
    },
  }).createMachine({
    id: 'paymentFlow',
    initial: 'idle',

    // RESET from any state
    on: {
      RESET: { target: '.idle', actions: 'clear' },
    },

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
          REFRESH: {
            target: 'fetchingStatus',
            actions: assign({
              providerId: ({ event }) => event.providerId,
            }),
          },
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

          // ✅ útil si hay flujos que requieren acción pero aún quieres refrescar status
          REFRESH: { target: 'fetchingStatus' },
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
          REFRESH: { target: 'fetchingStatus' },
          CANCEL: { target: 'cancelling' },
        },
      },

      fetchingStatus: {
        invoke: {
          src: 'status',
          input: ({ context, event }) => {
            const refreshEvent = event.type === 'REFRESH' ? event : null;

            const providerId = context.providerId ?? refreshEvent?.providerId ?? null;
            const intentId = context.intent?.id ?? refreshEvent?.intentId ?? null;

            if (!providerId || !intentId) {
              throw new Error('Missing providerId/intentId for status refresh');
            }

            return { providerId, intentId };
          },
          onDone: { target: 'afterStatus', actions: 'setIntent' },
          onError: { target: 'failed', actions: 'setError' },
        },
      },

      afterStatus: {
        always: [
          // ✅ refresh puede regresar un nuevo requires_action
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
        on: { RESET: { target: 'idle', actions: 'clear' } },
      },

      done: {
        on: { RESET: { target: 'idle', actions: 'clear' } },
      },
    },
  });
