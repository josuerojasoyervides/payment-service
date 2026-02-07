import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { generateId } from '@app/features/payments/infrastructure/fake/shared/helpers/get-id.helper';
import type { TokenBehavior } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';
import { getTokenBehavior } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';
import { TokenBehaviorSchema } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';
import { CURRENCY_CODES } from '@payments/domain/common/primitives/money/currency.types';
import { PAYMENT_METHOD_TYPES } from '@payments/domain/subdomains/payment/entities/payment-method.types';
import { z } from 'zod';

/** Stripe-compatible status for DTO mapping. */
export const FakeIntentStatusSchema = z.enum([
  'requires_confirmation',
  'requires_action',
  'processing',
  'succeeded',
  'canceled',
]);
export type FakeIntentStatus = z.infer<typeof FakeIntentStatusSchema>;

export interface FakeIntentState {
  intentId: string;
  scenarioId: TokenBehavior;
  providerId: PaymentProviderId;
  createdAt: number;
  stepCount: number;
  currentStatus: FakeIntentStatus;
  nextActionKind?: 'redirect' | 'client_confirm';
  remainingRefreshesToSucceed?: number;
  clientConfirmed?: boolean;
  correlationId?: string;
  amount?: number;
  currency?: string;
  clientSecret?: string;
}

export interface FakeIntentCreateInput {
  token?: string;
  providerId: PaymentProviderId;
  request: CreatePaymentRequest;
}

const FakeCreatePaymentRequestSchema = z.object({
  orderId: z.object({ value: z.string().min(1) }),
  money: z.object({
    amount: z.number(),
    currency: z.enum(CURRENCY_CODES),
  }),
  method: z.object({
    type: z.enum(PAYMENT_METHOD_TYPES),
    token: z.string().optional(),
  }),
  returnUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
  customerEmail: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const FakeIntentCreateInputSchema = z.object({
  token: z.string().optional(),
  providerId: z.string(),
  request: FakeCreatePaymentRequestSchema,
});

export const FakeIntentStateSchema = z.object({
  intentId: z.string(),
  scenarioId: TokenBehaviorSchema,
  providerId: z.string(),
  createdAt: z.number(),
  stepCount: z.number(),
  currentStatus: FakeIntentStatusSchema,
  nextActionKind: z.enum(['redirect', 'client_confirm']).optional(),
  remainingRefreshesToSucceed: z.number().optional(),
  clientConfirmed: z.boolean().optional(),
  correlationId: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  clientSecret: z.string().optional(),
});

const PROCESSING_REFRESHES = 2;
const ERROR_BEHAVIORS: TokenBehavior[] = [
  'fail',
  'timeout',
  'decline',
  'insufficient',
  'expired',
  'circuit',
  'rate_limit',
  'retry_exhaust',
  'half_open_fail',
];

const fakeIntentsById = new Map<string, FakeIntentState>();

/**
 * Create and store intent state for non-error behaviors.
 * Caller must throw for error behaviors (timeout, decline, etc.) before calling this.
 */
export function createFakeIntentState(input: FakeIntentCreateInput): FakeIntentState {
  const parsed = FakeIntentCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error('Invalid fake intent input');
  }
  const safeInput = parsed.data;

  const behavior = getTokenBehavior(safeInput.request.method?.token);
  if (ERROR_BEHAVIORS.includes(behavior)) {
    throw new Error(`createFakeIntentState: cannot create for error behavior "${behavior}"`);
  }

  const intentId = generateId('pi');
  let currentStatus: FakeIntentStatus = 'requires_confirmation';
  let nextActionKind: 'redirect' | 'client_confirm' | undefined;
  let remainingRefreshesToSucceed: number | undefined;

  if (behavior === 'success') {
    currentStatus = 'succeeded';
  } else if (
    behavior === 'normal' &&
    safeInput.request.method?.token === 'tok_visa1234567890abcdef'
  ) {
    currentStatus = 'succeeded';
  } else if (behavior === '3ds') {
    currentStatus = 'requires_action';
    nextActionKind = 'redirect';
  } else if (behavior === 'client_confirm') {
    currentStatus = 'requires_action';
    nextActionKind = 'client_confirm';
  } else if (behavior === 'processing') {
    currentStatus = 'processing';
    remainingRefreshesToSucceed = PROCESSING_REFRESHES;
  }

  const amountCents = Math.round((safeInput.request.money?.amount ?? 0) * 100);
  const clientSecret = `${intentId}_secret_${generateId('sec')}`;
  const state: FakeIntentState = {
    intentId,
    scenarioId: behavior,
    providerId: safeInput.providerId,
    createdAt: Date.now(),
    stepCount: 0,
    currentStatus,
    nextActionKind,
    remainingRefreshesToSucceed,
    correlationId: safeInput.request.orderId.value,
    amount: amountCents,
    currency: (safeInput.request.money?.currency ?? 'MXN').toLowerCase(),
    clientSecret,
  };

  fakeIntentsById.set(intentId, state);
  return state;
}

export function getFakeIntentState(intentId: string): FakeIntentState | null {
  return fakeIntentsById.get(intentId) ?? null;
}

/**
 * Advance state on refresh: processing -> decrement remaining -> succeeded when 0;
 * client_confirm + clientConfirmed -> succeeded.
 */
export function refreshFakeIntentState(intentId: string): FakeIntentState | null {
  const state = fakeIntentsById.get(intentId);
  if (!state) return null;

  const next: FakeIntentState = { ...state, stepCount: state.stepCount + 1 };

  if (state.scenarioId === 'processing' && state.remainingRefreshesToSucceed !== undefined) {
    const remaining = state.remainingRefreshesToSucceed - 1;
    next.remainingRefreshesToSucceed = remaining;
    if (remaining <= 0) {
      next.currentStatus = 'succeeded';
    }
  } else if (state.scenarioId === 'client_confirm' && state.clientConfirmed) {
    next.currentStatus = 'succeeded';
  }

  fakeIntentsById.set(intentId, next);
  return next;
}

export function markFakeIntentClientConfirmed(intentId: string): FakeIntentState | null {
  const state = fakeIntentsById.get(intentId);
  if (!state || state.scenarioId !== 'client_confirm') return state ?? null;

  const next: FakeIntentState = { ...state, clientConfirmed: true };
  fakeIntentsById.set(intentId, next);
  return next;
}

/** Dev/testing only. */
export function resetFakeIntentState(): void {
  fakeIntentsById.clear();
}
