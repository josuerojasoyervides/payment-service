import { setup } from 'xstate';

import { paymentFlowActions } from './payment-flow.actions';
import { createPaymentFlowActors } from './payment-flow.actors';
import { paymentFlowGuards } from './payment-flow.guards';
import { PaymentFlowDeps, PaymentFlowEvent, PaymentFlowMachineContext } from './payment-flow.types';

export interface machineTypes {
  context: PaymentFlowMachineContext;
  events: PaymentFlowEvent;
}

export const machineTypes: machineTypes = {
  context: {} as PaymentFlowMachineContext,
  events: {} as PaymentFlowEvent,
};

export const createPaymentFlowMachine = (deps: PaymentFlowDeps) =>
  setup({
    types: machineTypes,

    actors: createPaymentFlowActors(deps),

    actions: paymentFlowActions,

    guards: paymentFlowGuards,
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
          REFRESH: { target: 'fetchingStatus' },
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
        always: [
          { guard: 'needsUserAction', target: 'requiresAction' }, // ✅ NUEVO
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
