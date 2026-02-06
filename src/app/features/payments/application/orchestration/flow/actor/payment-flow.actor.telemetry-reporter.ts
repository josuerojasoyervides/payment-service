import type { FlowTelemetrySink } from '@payments/application/adapters/telemetry/types/flow-telemetry.types';
import {
  recordCommandSent,
  recordEffectTelemetry,
  recordErrorTelemetry,
  recordResilienceTelemetry,
  recordStateTelemetry,
  recordSystemEventSent,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.actor.telemetry';
import { snapshotTelemetryBase } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.actor.utils';
import type {
  PaymentFlowCommandEvent,
  PaymentFlowSnapshot,
  PaymentFlowSystemEvent,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Records flow telemetry events with local dedupe state.
 */
export class PaymentFlowTelemetryReporter {
  private lastErrorCodeForTelemetry: string | null = null;

  constructor(private readonly telemetry: FlowTelemetrySink) {}

  recordCommandSent(snapshot: PaymentFlowSnapshot, event: PaymentFlowCommandEvent): void {
    recordCommandSent(this.telemetry, snapshot, event);
  }

  recordSystemEventSent(snapshot: PaymentFlowSnapshot, event: PaymentFlowSystemEvent): void {
    recordSystemEventSent(this.telemetry, snapshot, event);
  }

  recordSnapshot(snapshot: PaymentFlowSnapshot, prevSnapshot: PaymentFlowSnapshot | null): void {
    const base = snapshotTelemetryBase(snapshot);
    const atMs = Date.now();

    recordEffectTelemetry(this.telemetry, snapshot, prevSnapshot, atMs, base);
    recordResilienceTelemetry(this.telemetry, snapshot, prevSnapshot, atMs, base);
    this.lastErrorCodeForTelemetry = recordErrorTelemetry(
      this.telemetry,
      snapshot,
      this.lastErrorCodeForTelemetry,
      atMs,
      base,
    );
    recordStateTelemetry(this.telemetry, snapshot, atMs, base);
  }
}
