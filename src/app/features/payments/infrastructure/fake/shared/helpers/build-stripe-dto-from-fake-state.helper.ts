import type { FakeIntentState } from '@app/features/payments/infrastructure/fake/shared/state/fake-intent.store';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';

const DEFAULT_DELAY_MS = 200;

export interface FakeDebugPayload {
  scenarioId: string;
  stepCount: number;
  simulatedDelayMs: number;
  correlationId?: string;
  createdAt: number;
}

export function buildStripeDtoFromFakeState(
  state: FakeIntentState,
  simulatedDelayMs: number = DEFAULT_DELAY_MS,
): StripePaymentIntentDto & { _fakeDebug?: FakeDebugPayload } {
  const amountCents = state.amount ?? 10000;
  const currency = state.currency ?? 'mxn';
  const status = state.currentStatus;
  const amountReceived = status === 'succeeded' ? amountCents : 0;

  let next_action: StripePaymentIntentDto['next_action'] = null;
  if (status === 'requires_action' && state.nextActionKind) {
    if (state.nextActionKind === 'client_confirm') {
      next_action = { type: 'use_stripe_sdk' };
    } else {
      next_action = {
        type: 'redirect_to_url',
        redirect_to_url: {
          url: `https://hooks.stripe.com/3d_secure_2/authenticate/${state.intentId}`,
          return_url: `${typeof window !== 'undefined' ? window.location.origin : ''}/payments/return`,
        },
      };
    }
  }

  const dto: StripePaymentIntentDto & { _fakeDebug?: FakeDebugPayload } = {
    id: state.intentId,
    object: 'payment_intent',
    amount: amountCents,
    amount_received: amountReceived,
    currency,
    status,
    client_secret: state.clientSecret ?? `${state.intentId}_secret`,
    created: Math.floor(state.createdAt / 1000),
    livemode: false,
    metadata: state.correlationId ? { order_id: state.correlationId } : {},
    payment_method: null,
    payment_method_types: ['card'],
    capture_method: 'automatic',
    confirmation_method: 'automatic',
    next_action,
  };

  dto._fakeDebug = {
    scenarioId: state.scenarioId,
    stepCount: state.stepCount,
    simulatedDelayMs,
    correlationId: state.correlationId,
    createdAt: state.createdAt,
  };

  return dto;
}
