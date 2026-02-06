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

/**
 * Records a public command emission for telemetry.
 */
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

/**
 * Records a system event emission with correlation refs if available.
 */
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

/**
 * Emits effect start/finish boundaries based on snapshot tags.
 */
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

const CLIENT_CONFIRM_RETRY_DELAY_MS = 500;
const FINALIZE_RETRY_DELAY_MS = 1000;

function resolveOperationType(snapshot: PaymentFlowSnapshot): string | undefined {
  if (snapshot.hasTag('starting')) return 'start';
  if (snapshot.hasTag('confirming')) return 'confirm';
  if (snapshot.hasTag('clientConfirming') || snapshot.hasTag('clientConfirmRetrying')) {
    return 'client_confirm';
  }
  if (snapshot.hasTag('finalizing') || snapshot.hasTag('finalizeRetrying')) return 'finalize';
  if (
    snapshot.hasTag('polling') ||
    snapshot.hasTag('fetchingStatus') ||
    snapshot.hasTag('statusRetrying')
  ) {
    return 'status';
  }
  return undefined;
}

/**
 * Emits resilience telemetry on circuit/rate-limit/retry transitions.
 */
export function recordResilienceTelemetry(
  telemetry: FlowTelemetrySink,
  snapshot: PaymentFlowSnapshot,
  prevSnapshot: PaymentFlowSnapshot | null,
  atMs: number = Date.now(),
  base: SnapshotTelemetryBase = snapshotTelemetryBase(snapshot),
): void {
  const wasCircuitOpen = prevSnapshot?.hasTag('circuitOpen') ?? false;
  const wasCircuitHalfOpen = prevSnapshot?.hasTag('circuitHalfOpen') ?? false;
  const isCircuitOpen = snapshot.hasTag('circuitOpen');
  const isCircuitHalfOpen = snapshot.hasTag('circuitHalfOpen');

  if (!wasCircuitOpen && isCircuitOpen) {
    telemetry.record({
      kind: 'RESILIENCE_EVENT',
      eventType: 'CIRCUIT_OPENED',
      atMs,
      ...base,
      meta: {
        operationType: resolveOperationType(snapshot),
        errorCode: snapshot.context.error?.code,
        previousState: prevSnapshot ? String(prevSnapshot.value) : null,
      },
    });
  }

  if (!wasCircuitHalfOpen && isCircuitHalfOpen) {
    telemetry.record({
      kind: 'RESILIENCE_EVENT',
      eventType: 'CIRCUIT_HALF_OPEN',
      atMs,
      ...base,
    });
  }

  if ((wasCircuitOpen || wasCircuitHalfOpen) && !isCircuitOpen && !isCircuitHalfOpen) {
    const openedAt = prevSnapshot?.context.resilience.circuitOpenedAt ?? null;
    telemetry.record({
      kind: 'RESILIENCE_EVENT',
      eventType: 'CIRCUIT_CLOSED',
      atMs,
      ...base,
      meta: {
        durationMs: openedAt ? Math.max(0, atMs - openedAt) : undefined,
      },
    });
  }

  const wasRateLimited = prevSnapshot?.hasTag('rateLimited') ?? false;
  const isRateLimited = snapshot.hasTag('rateLimited');
  if (!wasRateLimited && isRateLimited) {
    telemetry.record({
      kind: 'RESILIENCE_EVENT',
      eventType: 'RATE_LIMIT_HIT',
      atMs,
      ...base,
      meta: {
        retryAfterMs: snapshot.context.resilience.rateLimitCooldownMs ?? undefined,
      },
    });
  }

  const wasClientRetrying = prevSnapshot?.hasTag('clientConfirmRetrying') ?? false;
  const isClientRetrying = snapshot.hasTag('clientConfirmRetrying');
  if (!wasClientRetrying && isClientRetrying) {
    telemetry.record({
      kind: 'RESILIENCE_EVENT',
      eventType: 'RETRY_ATTEMPTED',
      atMs,
      ...base,
      meta: {
        operationType: 'client_confirm',
        attemptNumber: snapshot.context.clientConfirmRetry.count,
        durationMs: CLIENT_CONFIRM_RETRY_DELAY_MS,
      },
    });
  }

  const wasFinalizeRetrying = prevSnapshot?.hasTag('finalizeRetrying') ?? false;
  const isFinalizeRetrying = snapshot.hasTag('finalizeRetrying');
  if (!wasFinalizeRetrying && isFinalizeRetrying) {
    telemetry.record({
      kind: 'RESILIENCE_EVENT',
      eventType: 'RETRY_ATTEMPTED',
      atMs,
      ...base,
      meta: {
        operationType: 'finalize',
        attemptNumber: snapshot.context.finalizeRetry.count,
        durationMs: FINALIZE_RETRY_DELAY_MS,
      },
    });
  }

  const wasPendingManualReview = prevSnapshot?.hasTag('pendingManualReview') ?? false;
  const isPendingManualReview = snapshot.hasTag('pendingManualReview');
  if (!wasPendingManualReview && isPendingManualReview) {
    telemetry.record({
      kind: 'RESILIENCE_EVENT',
      eventType: 'RETRY_EXHAUSTED',
      atMs,
      ...base,
      meta: {
        operationType: 'finalize',
        attemptNumber: snapshot.context.finalizeRetry.count,
        errorCode: snapshot.context.error?.code,
      },
    });
  }
}

/**
 * Emits error telemetry with simple dedupe by error code.
 */
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

/**
 * Records state transitions with tags and status.
 */
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
