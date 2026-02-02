import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { generateId } from '@app/features/payments/infrastructure/fake/shared/helpers/get-id.helper';
import type { TokenBehavior } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';
import { getTokenBehavior } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';

/** Stripe-compatible status for DTO mapping. */
export type FakeIntentStatus =
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled';

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

const PROCESSING_REFRESHES = 2;
const ERROR_BEHAVIORS: TokenBehavior[] = ['fail', 'timeout', 'decline', 'insufficient', 'expired'];

/**
 * In-memory store for fake intents. Tracks scenario, stepCount, and status
 * so refresh/confirm transitions are deterministic and demo-grade.
 */
@Injectable()
export class FakeIntentStore {
  private readonly byId = new Map<string, FakeIntentState>();

  /**
   * Create and store intent state for non-error behaviors.
   * Caller must throw for error behaviors (timeout, decline, etc.) before calling this.
   */
  createIntent(input: FakeIntentCreateInput): FakeIntentState {
    const behavior = getTokenBehavior(input.request.method?.token);
    if (ERROR_BEHAVIORS.includes(behavior)) {
      throw new Error(
        `FakeIntentStore.createIntent: cannot create for error behavior "${behavior}"`,
      );
    }

    const intentId = generateId('pi');
    let currentStatus: FakeIntentStatus = 'requires_confirmation';
    let nextActionKind: 'redirect' | 'client_confirm' | undefined;
    let remainingRefreshesToSucceed: number | undefined;

    if (behavior === 'success') {
      currentStatus = 'succeeded';
    } else if (
      behavior === 'normal' &&
      input.request.method?.token === 'tok_visa1234567890abcdef'
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

    const amountCents = Math.round((input.request.money?.amount ?? 0) * 100);
    const clientSecret = `${intentId}_secret_${generateId('sec')}`;
    const state: FakeIntentState = {
      intentId,
      scenarioId: behavior,
      providerId: input.providerId,
      createdAt: Date.now(),
      stepCount: 0,
      currentStatus,
      nextActionKind,
      remainingRefreshesToSucceed,
      correlationId: input.request.orderId.value,
      amount: amountCents,
      currency: (input.request.money?.currency ?? 'MXN').toLowerCase(),
      clientSecret,
    };

    this.byId.set(intentId, state);
    return state;
  }

  get(intentId: string): FakeIntentState | null {
    return this.byId.get(intentId) ?? null;
  }

  /**
   * Advance state on refresh: processing -> decrement remaining -> succeeded when 0;
   * client_confirm + clientConfirmed -> succeeded.
   */
  refresh(intentId: string): FakeIntentState | null {
    const state = this.byId.get(intentId);
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

    this.byId.set(intentId, next);
    return next;
  }

  markClientConfirmed(intentId: string): FakeIntentState | null {
    const state = this.byId.get(intentId);
    if (!state || state.scenarioId !== 'client_confirm') return state ?? null;

    const next: FakeIntentState = { ...state, clientConfirmed: true };
    this.byId.set(intentId, next);
    return next;
  }

  /** Dev/testing only. */
  reset(): void {
    this.byId.clear();
  }
}
