/**
 * Tests-only scenario harness for payment flow stress tests (PR6.2).
 * Boots the flow actor with InMemory telemetry; exposes sendCommand, sendSystem,
 * getSnapshot, telemetry helpers, and flush/fake-timer utilities.
 */
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type {
  ExternalStatusUpdatedPayload,
  RedirectReturnedPayload,
  WebhookReceivedPayload,
} from '@app/features/payments/application/adapters/events/flow/payment-flow.events';
import type { FlowTelemetryEvent } from '@payments/application/adapters/telemetry/flow-telemetry.types';
import { FLOW_TELEMETRY_SINK } from '@payments/application/adapters/telemetry/flow-telemetry-sink.token';
import { InMemoryFlowTelemetrySink } from '@payments/application/adapters/telemetry/in-memory-flow-telemetry-sink';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import type {
  PaymentFlowCommandEvent,
  PaymentFlowSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import providePayments from '@payments/config/payment.providers';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import { vi } from 'vitest';

export interface ScenarioHarness {
  sendCommand(type: string, payload?: Record<string, unknown>): boolean;
  sendSystem(
    type: 'REDIRECT_RETURNED' | 'WEBHOOK_RECEIVED' | 'EXTERNAL_STATUS_UPDATED',
    payload: RedirectReturnedPayload | WebhookReceivedPayload | ExternalStatusUpdatedPayload,
  ): void;
  getSnapshot(): PaymentFlowSnapshot;
  getTelemetryEvents(): readonly FlowTelemetryEvent[];
  countEvents(
    kindOrPredicate?: FlowTelemetryEvent['kind'] | ((e: FlowTelemetryEvent) => boolean),
  ): number;
  findLastEvent(predicate: (e: FlowTelemetryEvent) => boolean): FlowTelemetryEvent | undefined;
  flushMicrotasks(times?: number): Promise<void>;
  useFakeTimers(): void;
  tick(ms: number): void;
  useRealTimers(): void;
}

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

export interface ScenarioHarnessOptions {
  extraProviders?: Provider[];
}

export function createScenarioHarness(options?: ScenarioHarnessOptions): ScenarioHarness {
  TestBed.resetTestingModule();
  const sink = new InMemoryFlowTelemetrySink(500);

  TestBed.configureTestingModule({
    providers: [
      ...providePayments(),
      { provide: FLOW_TELEMETRY_SINK, useValue: sink },
      ...(options?.extraProviders ?? []),
    ],
  });

  const actor = TestBed.inject(PaymentFlowActorService);

  return {
    sendCommand(type: string, payload?: Record<string, unknown>): boolean {
      const event = buildCommandEvent(type, payload);
      return actor.send(event);
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
    getTelemetryEvents(): readonly FlowTelemetryEvent[] {
      return sink.getEvents();
    },
    countEvents(
      kindOrPredicate?: FlowTelemetryEvent['kind'] | ((e: FlowTelemetryEvent) => boolean),
    ): number {
      return sink.count(kindOrPredicate);
    },
    findLastEvent(predicate: (e: FlowTelemetryEvent) => boolean): FlowTelemetryEvent | undefined {
      return sink.findLast(predicate);
    },
    async flushMicrotasks(times = 3): Promise<void> {
      for (let i = 0; i < times; i++) await Promise.resolve();
    },
    useFakeTimers(): void {
      vi.useFakeTimers();
    },
    tick(ms: number): void {
      vi.advanceTimersByTime(ms);
    },
    useRealTimers(): void {
      vi.useRealTimers();
    },
  };
}
