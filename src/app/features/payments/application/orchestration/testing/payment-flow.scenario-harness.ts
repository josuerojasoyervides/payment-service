/**
 * Deterministic scenario harness for payment flow stress tests (PR6 Phase C).
 * Uses FLOW_TELEMETRY_SINK with InMemoryFlowTelemetrySink; exposes state (port), telemetry, sendCommand, sendSystem, flush, advance, drain.
 * Harness does not import @payments/infrastructure.
 */
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type {
  ExternalStatusUpdatedPayload,
  RedirectReturnedPayload,
  WebhookReceivedPayload,
} from '@app/features/payments/application/adapters/events/flow/payment-flow.events';
import { InMemoryFlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/dev-only/in-memory-flow-telemetry-sink';
import type { PaymentFlowPort } from '@app/features/payments/application/api/ports/payment-store.port';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { FLOW_TELEMETRY_SINK } from '@app/features/payments/application/api/tokens/telemetry/flow-telemetry-sink.token';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import type {
  PaymentFlowCommandEvent,
  PaymentFlowSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import providePayments from '@payments/config/payment.providers';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
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
  if (type === 'REFRESH') {
    const rawIntentId = payload?.['intentId'];
    const intentId =
      rawIntentId != null && typeof rawIntentId === 'string'
        ? (() => {
            const r = PaymentIntentId.from(rawIntentId);
            return r.ok ? r.value : undefined;
          })()
        : (rawIntentId as PaymentIntentId | undefined);
    return {
      type: 'REFRESH',
      providerId: payload?.['providerId'] as PaymentProviderId | undefined,
      intentId,
    };
  }
  throw new Error(`Unsupported command type: ${type}`);
}

export interface PaymentFlowScenarioHarnessOptions {
  extraProviders?: Provider[];
  /** Default true. If true, vi.useFakeTimers() is called during setup; advance(ms) then works. If false, advance(ms) throws. */
  useFakeTimers?: boolean;
}

export interface PaymentFlowScenarioHarness {
  /** InMemoryFlowTelemetrySink (PR6 observability) for timeline assertions */
  telemetry: InMemoryFlowTelemetrySink;
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
  /** Restore real timers and reset TestBed; call in afterEach to avoid leaking fake timers between tests. */
  dispose(): void;
}

/**
 * Creates a scenario harness with TestBed, FLOW_TELEMETRY_SINK (InMemoryFlowTelemetrySink), and optional overrides.
 */
export function createPaymentFlowScenarioHarness(
  options?: PaymentFlowScenarioHarnessOptions,
): PaymentFlowScenarioHarness {
  TestBed.resetTestingModule();
  const useFakeTimers = options?.useFakeTimers !== false;
  if (useFakeTimers) {
    vi.useFakeTimers();
  }

  const sink = new InMemoryFlowTelemetrySink();

  TestBed.configureTestingModule({
    providers: [
      ...providePayments(),
      { provide: FLOW_TELEMETRY_SINK, useValue: sink },
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
      if (!useFakeTimers) {
        throw new Error(
          'advance(ms) requires useFakeTimers: true. Pass useFakeTimers: true in createPaymentFlowScenarioHarness options.',
        );
      }
      vi.advanceTimersByTime(ms);
    },
    async drain(): Promise<void> {
      await this.flushMicrotasks(3);
      this.advance(0);
      await this.flushMicrotasks(3);
    },
    debugStateNode(): string | null {
      return state.debugStateNode() ?? null;
    },
    dispose(): void {
      vi.useRealTimers();
      TestBed.resetTestingModule();
    },
  };
}
