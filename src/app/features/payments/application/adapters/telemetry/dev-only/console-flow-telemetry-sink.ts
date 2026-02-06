// console-flow-telemetry-sink.ts
import type {
  FlowTelemetryEvent,
  FlowTelemetryRefs,
  FlowTelemetrySink,
} from '@payments/application/adapters/telemetry/types/flow-telemetry.types';

type SafeLog = Record<string, unknown>;

const FORBIDDEN_KEYS = new Set([
  'raw',
  'headers',
  'authorization',
  'token',
  'clientSecret',
  'email',
  'request',
  'response',
]);

const MAX_STRING_LEN = 300;
const MAX_META_KEYS = 30;
const MAX_REFS_KEYS = 20;

export class ConsoleFlowTelemetrySink implements FlowTelemetrySink {
  record(event: FlowTelemetryEvent): void {
    const safe = redactForLog(event);
    console.debug('[FlowTelemetry]', event.kind, safe);
  }
}

function redactForLog(event: FlowTelemetryEvent): SafeLog {
  const base: SafeLog = {
    kind: event.kind,
    atMs: event.atMs,
    flowId: event.flowId,
    providerId: event.providerId,
    refs: sanitizeRefsForLog(event.refs),
  };

  switch (event.kind) {
    case 'COMMAND_SENT':
    case 'SYSTEM_EVENT_SENT':
      return { ...base, eventType: event.eventType, meta: sanitizeMetaForLog(event.meta) };

    case 'RESILIENCE_EVENT':
      return { ...base, eventType: event.eventType, meta: sanitizeMetaForLog(event.meta) };

    case 'STATE_CHANGED':
      return {
        ...base,
        state: event.state,
        tags: event.tags,
        errorCode: event.errorCode,
        status: event.status,
        meta: sanitizeMetaForLog(event.meta),
      };

    case 'EFFECT_START':
    case 'EFFECT_FINISH':
      return { ...base, effect: event.effect, meta: sanitizeMetaForLog(event.meta) };

    case 'ERROR_RAISED':
      return { ...base, errorCode: event.errorCode, meta: sanitizeMetaForLog(event.meta) };

    default: {
      // Exhaustiveness check: if a new kind is added, TS should complain here.
      const _never: never = event;
      return { ...base, kind: (_never as FlowTelemetryEvent).kind };
    }
  }
}

function sanitizeRefsForLog(refs?: FlowTelemetryRefs): FlowTelemetryRefs | undefined {
  if (!refs) return undefined;

  const out: FlowTelemetryRefs = {};
  let count = 0;

  for (const [k, v] of Object.entries(refs)) {
    if (count >= MAX_REFS_KEYS) break;
    if (FORBIDDEN_KEYS.has(k)) continue;

    out[k] = typeof v === 'string' ? truncate(v) : undefined;
    count++;
  }

  return out;
}

function sanitizeMetaForLog(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;

  const out: Record<string, unknown> = {};
  let count = 0;

  for (const [k, v] of Object.entries(meta)) {
    if (count >= MAX_META_KEYS) break;
    if (FORBIDDEN_KEYS.has(k)) continue;

    out[k] = sanitizeValueForLog(v);
    count++;
  }

  return out;
}

function sanitizeValueForLog(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  // Keep logs readable and avoid massive dumps.
  if (Array.isArray(value)) return `[array len=${value.length}]`;
  if (typeof value === 'object') return '[object]';

  return String(value);
}

function truncate(value: string): string {
  return value.length > MAX_STRING_LEN ? value.slice(0, MAX_STRING_LEN) + '…' : value;
}
