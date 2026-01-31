/**
 * Deterministic scenario harness for payment flow stress tests (PR6 Phase C).
 * Uses PAYMENTS_FLOW_TELEMETRY_SINK with InMemoryTelemetrySink; exposes state (port), telemetry, sendCommand, sendSystem, flush, advance, drain.
 * Harness does not import @payments/infrastructure.
 */
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type {
  ExternalStatusUpdatedPayload,
  RedirectReturnedPayload,
  WebhookReceivedPayload,
} from '@app/features/payments/application/adapters/events/flow/payment-flow.events';
import type { PaymentFlowPort } from '@app/features/payments/application/api/ports/payment-store.port';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { PAYMENTS_FLOW_TELEMETRY_SINK } from '@payments/application/observability/telemetry/flow-telemetry.sink';
import { InMemoryTelemetrySink } from '@payments/application/observability/telemetry/sinks/in-memory-telemetry.sink';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import type {
  PaymentFlowCommandEvent,
  PaymentFlowSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import providePayments from '@payments/config/payment.providers';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import { vi } from 'vitest';

function buildCommandEvent(
  type: string,
  payload?: Record<string, unknown>,
): PaymentFlowCommandEvent {
  if (type === 'RESET') return { type: 'RESET' };
  if (type === 'START' && payload?.['providerId'] != null && payload?.['request'] != null)
    return {
      type: 'START',
      providerId: payload['providerId'] as PaymentProviderId,
      request: payload['request'] as CreatePaymentRequest,
    };
  if (type === 'REFRESH')
    return {
      type: 'REFRESH',
      providerId: payload?.['providerId'] as PaymentProviderId | undefined,
      intentId: payload?.['intentId'] as string | undefined,
    };
  throw new Error(`Unsupported command type: ${type}`);
}

export interface PaymentFlowScenarioHarnessOptions {
  extraProviders?: Provider[];
}

export interface PaymentFlowScenarioHarness {
  /** InMemoryTelemetrySink (PR6 observability) for timeline assertions */
  telemetry: InMemoryTelemetrySink;
  /** PaymentFlowPort (PAYMENT_STATE) for store/UI-facing state */
  state: PaymentFlowPort;
  sendCommand(type: string, payload?: Record<string, unknown>): boolean;
  sendSystem(
    type: 'REDIRECT_RETURNED' | 'WEBHOOK_RECEIVED' | 'EXTERNAL_STATUS_UPDATED',
    payload: RedirectReturnedPayload | WebhookReceivedPayload | ExternalStatusUpdatedPayload,
  ): void;
  getSnapshot(): PaymentFlowSnapshot;
  flushMicrotasks(times?: number): Promise<void>;
  advance(ms: number): void;
  drain(): Promise<void>;
  /** Optional: current debug state node from port */
  debugStateNode(): string | null;
}

/**
 * Creates a scenario harness with TestBed, PAYMENTS_FLOW_TELEMETRY_SINK (InMemoryTelemetrySink), and optional overrides.
 */
export function createPaymentFlowScenarioHarness(
  options?: PaymentFlowScenarioHarnessOptions,
): PaymentFlowScenarioHarness {
  TestBed.resetTestingModule();
  const sink = new InMemoryTelemetrySink();

  TestBed.configureTestingModule({
    providers: [
      ...providePayments(),
      { provide: PAYMENTS_FLOW_TELEMETRY_SINK, useValue: sink },
      ...(options?.extraProviders ?? []),
    ],
  });

  const actor = TestBed.inject(PaymentFlowActorService);
  const state = TestBed.inject(PAYMENT_STATE);

  return {
    telemetry: sink,
    state,
    sendCommand(type: string, payload?: Record<string, unknown>): boolean {
      return actor.send(buildCommandEvent(type, payload));
    },
    sendSystem(
      type: 'REDIRECT_RETURNED' | 'WEBHOOK_RECEIVED' | 'EXTERNAL_STATUS_UPDATED',
      payload: RedirectReturnedPayload | WebhookReceivedPayload | ExternalStatusUpdatedPayload,
    ): void {
      if (type === 'REDIRECT_RETURNED')
        actor.sendSystem({
          type: 'REDIRECT_RETURNED',
          payload: payload as RedirectReturnedPayload,
        });
      else if (type === 'WEBHOOK_RECEIVED')
        actor.sendSystem({ type: 'WEBHOOK_RECEIVED', payload: payload as WebhookReceivedPayload });
      else
        actor.sendSystem({
          type: 'EXTERNAL_STATUS_UPDATED',
          payload: payload as ExternalStatusUpdatedPayload,
        });
    },
    getSnapshot(): PaymentFlowSnapshot {
      return actor.snapshot() as PaymentFlowSnapshot;
    },
    async flushMicrotasks(times = 3): Promise<void> {
      for (let i = 0; i < times; i++) await Promise.resolve();
    },
    advance(ms: number): void {
      try {
        vi.advanceTimersByTime(ms);
      } catch {
        // No-op when fake timers are not active
      }
    },
    async drain(): Promise<void> {
      await this.flushMicrotasks(3);
      this.advance(0);
      await this.flushMicrotasks(3);
    },
    debugStateNode(): string | null {
      return state.debugStateNode() ?? null;
    },
  };
}
