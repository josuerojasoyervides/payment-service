import { assign } from 'xstate';

import { normalizePaymentError } from '../store/payment-store.errors';
import type {
  PaymentFlowActorLogicMap,
  PaymentFlowEvent,
  PaymentFlowMachineContext,
  ProvidedActorFromMap,
} from './payment-flow.types';

type Ctx = PaymentFlowMachineContext;
type Ev = PaymentFlowEvent;

// ✅ union exacto de actors reales (start|confirm|cancel|status)
type Act = ProvidedActorFromMap<PaymentFlowActorLogicMap>;

export const paymentFlowActions = {
  setStartInput: assign<Ctx, Ev, undefined, Ev, Act>(({ event }) => {
    if (event.type !== 'START') return {};
    return {
      providerId: event.providerId,
      request: event.request,
      flowContext: event.flowContext ?? null,
      intent: null,
      error: null,
    };
  }),

  setIntent: assign<Ctx, Ev, undefined, Ev, Act>(({ event }) => {
    if (!('output' in event)) return {};
    return { intent: event.output, error: null };
  }),

  setError: assign<Ctx, Ev, undefined, Ev, Act>(({ event }) => {
    if (!('error' in event)) return {};
    return { intent: null, error: normalizePaymentError(event.error) };
  }),

  clear: assign<Ctx, Ev, undefined, Ev, Act>(() => ({
    providerId: null,
    request: null,
    flowContext: null,
    intent: null,
    error: null,
  })),
};
