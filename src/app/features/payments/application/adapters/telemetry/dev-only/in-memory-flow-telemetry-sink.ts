import type {
  FlowTelemetryEvent,
  FlowTelemetrySink,
} from '@payments/application/adapters/telemetry/types/flow-telemetry.types';

function isDuplicateStateChanged(prev: FlowTelemetryEvent, next: FlowTelemetryEvent): boolean {
  if (prev.kind !== 'STATE_CHANGED' || next.kind !== 'STATE_CHANGED') return false;
  const sameState = prev.state === next.state;
  const sameError = (prev.errorCode ?? '') === (next.errorCode ?? '');
  const sameStatus = (prev.status ?? '') === (next.status ?? '');
  const sameTags =
    prev.tags.length === next.tags.length && prev.tags.every((t, i) => t === next.tags[i]);
  return sameState && sameError && sameStatus && sameTags;
}

export class InMemoryFlowTelemetrySink implements FlowTelemetrySink {
  private readonly events: FlowTelemetryEvent[] = [];
  private readonly maxEvents: number;
  private lastStateChanged: FlowTelemetryEvent | null = null;

  constructor(maxEvents = 500) {
    this.maxEvents = maxEvents;
  }

  record(event: FlowTelemetryEvent): void {
    if (event.kind === 'STATE_CHANGED' && this.lastStateChanged != null) {
      if (isDuplicateStateChanged(this.lastStateChanged, event)) return;
    }
    if (this.events.length >= this.maxEvents) {
      this.events.shift();
    }
    this.events.push(event);
    if (event.kind === 'STATE_CHANGED') this.lastStateChanged = event;
  }

  getEvents(): readonly FlowTelemetryEvent[] {
    return this.events;
  }

  findLast(predicate: (e: FlowTelemetryEvent) => boolean): FlowTelemetryEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (predicate(this.events[i])) return this.events[i];
    }
    return undefined;
  }

  count(
    predicateOrKind?: ((e: FlowTelemetryEvent) => boolean) | FlowTelemetryEvent['kind'],
  ): number {
    if (predicateOrKind == null) return this.events.length;
    if (typeof predicateOrKind === 'function') {
      return this.events.filter(predicateOrKind).length;
    }
    return this.events.filter((e) => e.kind === predicateOrKind).length;
  }
}
