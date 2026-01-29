import type { FlowTelemetryEvent } from '@payments/application/adapters/telemetry/types/flow-telemetry.types';

/**
 * Sink that logs flow telemetry to console (dev only).
 * Redaction: only safe fields are logged; no secrets or raw PII.
 */
export class ConsoleFlowTelemetrySink {
  record(event: FlowTelemetryEvent): void {
    const safe = redactForLog(event);

    console.log('[FlowTelemetry]', event.kind, safe);
  }
}

function redactForLog(event: FlowTelemetryEvent): Record<string, unknown> {
  const base: Record<string, unknown> = {
    kind: event.kind,
    atMs: event.atMs,
    flowId: event.flowId,
    providerId: event.providerId,
    refs: event.refs,
  };
  if (event.kind === 'COMMAND_SENT' || event.kind === 'SYSTEM_EVENT_SENT') {
    return { ...base, eventType: event.eventType, meta: event.meta };
  }
  if (event.kind === 'STATE_CHANGED') {
    return {
      ...base,
      state: event.state,
      tags: event.tags,
      errorCode: event.errorCode,
      status: event.status,
      meta: event.meta,
    };
  }
  if (event.kind === 'EFFECT_START' || event.kind === 'EFFECT_FINISH') {
    return { ...base, effect: event.effect, meta: event.meta };
  }
  if (event.kind === 'ERROR_RAISED') {
    return { ...base, errorCode: event.errorCode, meta: event.meta };
  }
  return base;
}
