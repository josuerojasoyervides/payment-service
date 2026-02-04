import type { FlowTelemetryRefs } from '@app/features/payments/application/adapters/telemetry/types/flow-telemetry.types';
import type { FlowTelemetrySink } from '@payments/application/adapters/telemetry/types/flow-telemetry.types';
import {
  resolveEffectTag,
  snapshotTelemetryBase,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.actor.utils';
import type {
  PaymentFlowCommandEvent,
  PaymentFlowSnapshot,
  PaymentFlowSystemEvent,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

type SnapshotTelemetryBase = ReturnType<typeof snapshotTelemetryBase>;

export function recordCommandSent(
  telemetry: FlowTelemetrySink,
  snapshot: PaymentFlowSnapshot,
  event: PaymentFlowCommandEvent,
  atMs: number = Date.now(),
  base: SnapshotTelemetryBase = snapshotTelemetryBase(snapshot),
): void {
  telemetry.record({
    kind: 'COMMAND_SENT',
    eventType: event.type,
    atMs,
    ...base,
  });
}

export function recordSystemEventSent(
  telemetry: FlowTelemetrySink,
  snapshot: PaymentFlowSnapshot,
  event: PaymentFlowSystemEvent,
  atMs: number = Date.now(),
  base: SnapshotTelemetryBase = snapshotTelemetryBase(snapshot),
): void {
  const payloadRefs: FlowTelemetryRefs | undefined =
    'payload' in event && event.payload && typeof event.payload === 'object'
      ? {
          referenceId: (event.payload as { referenceId?: string }).referenceId,
          eventId: (event.payload as { eventId?: string }).eventId,
        }
      : undefined;

  telemetry.record({
    kind: 'SYSTEM_EVENT_SENT',
    eventType: event.type,
    atMs,
    ...base,
    refs: payloadRefs ?? base.refs,
  });
}

export function recordEffectTelemetry(
  telemetry: FlowTelemetrySink,
  snapshot: PaymentFlowSnapshot,
  prevSnapshot: PaymentFlowSnapshot | null,
  atMs: number = Date.now(),
  base: SnapshotTelemetryBase = snapshotTelemetryBase(snapshot),
): void {
  const prevEffect = prevSnapshot ? resolveEffectTag(prevSnapshot) : null;
  const nowEffect = resolveEffectTag(snapshot);
  if (prevEffect && prevEffect !== nowEffect) {
    telemetry.record({
      kind: 'EFFECT_FINISH',
      effect: prevEffect,
      atMs,
      ...base,
    });
  }
  if (nowEffect && prevEffect !== nowEffect) {
    telemetry.record({
      kind: 'EFFECT_START',
      effect: nowEffect,
      atMs,
      ...base,
    });
  }
}

export function recordErrorTelemetry(
  telemetry: FlowTelemetrySink,
  snapshot: PaymentFlowSnapshot,
  lastErrorCodeForTelemetry: string | null,
  atMs: number = Date.now(),
  base: SnapshotTelemetryBase = snapshotTelemetryBase(snapshot),
): string | null {
  const error = snapshot.context.error;
  if (error?.code && error.code !== lastErrorCodeForTelemetry) {
    telemetry.record({
      kind: 'ERROR_RAISED',
      errorCode: error.code,
      atMs,
      ...base,
    });
    return error.code;
  }
  if (!error) return null;
  return lastErrorCodeForTelemetry;
}

export function recordStateTelemetry(
  telemetry: FlowTelemetrySink,
  snapshot: PaymentFlowSnapshot,
  atMs: number = Date.now(),
  base: SnapshotTelemetryBase = snapshotTelemetryBase(snapshot),
): void {
  telemetry.record({
    kind: 'STATE_CHANGED',
    state: String(snapshot.value),
    tags: Array.from(snapshot.tags ?? []),
    errorCode: snapshot.context.error?.code,
    status: snapshot.context.intent?.status,
    atMs,
    ...base,
  });
}
