import type {
  FlowTelemetryEvent,
  FlowTelemetrySink,
} from '@payments/application/adapters/telemetry/types/flow-telemetry.types';

type TelemetryId = string;
type StateChangedEvent = Extract<FlowTelemetryEvent, { kind: 'STATE_CHANGED' }>;

/** Sentinel id returned when an event is dropped (currently only for STATE_CHANGED dedupe). */
const DROPPED_EVENT_ID: TelemetryId = '';

/** Internal entry: id + event for ordered storage and O(1) lookup by id. */
interface EventEntry {
  id: TelemetryId;
  event: FlowTelemetryEvent;
}

function isStateChangedEvent(event: FlowTelemetryEvent): event is StateChangedEvent {
  return event.kind === 'STATE_CHANGED';
}

/**
 * Stable signature for deduping STATE_CHANGED.
 * - Uses a separator unlikely to appear naturally (`\u0000`).
 * - Uses JSON.stringify for tags to preserve order and avoid collisions.
 */
function stateChangedSignature(event: StateChangedEvent): string {
  const tags = JSON.stringify(event.tags ?? []);
  return [event.state, event.errorCode ?? '', event.status ?? '', tags].join('\u0000');
}

export class InMemoryFlowTelemetrySink implements FlowTelemetrySink {
  private readonly entries: EventEntry[] = [];
  private readonly byId = new Map<TelemetryId, FlowTelemetryEvent>();

  private nextId = 0;

  // Dedupe only applies to STATE_CHANGED, by signature of the last observed STATE_CHANGED.
  private lastStateChangedSig: string | null = null;

  constructor(private readonly maxEvents = 500) {
    // Defensive clamp: avoid a footgun where maxEvents <= 0 would cause undefined behavior.
    this.maxEvents = Math.max(1, maxEvents);
  }

  // --- Storage / lifecycle ---------------------------------------------------

  /** Current number of stored events. */
  get storageSize(): number {
    return this.entries.length;
  }

  /** Back-compat alias (more idiomatic for consumers). */
  get size(): number {
    return this.entries.length;
  }

  /** Clears storage (useful for tests). */
  clearStorage(): void {
    this.entries.length = 0;
    this.byId.clear();
    this.lastStateChangedSig = null;
    this.nextId = 0;
  }

  /** Back-compat alias. */
  clear(): void {
    this.clearStorage();
  }

  // --- Recording -------------------------------------------------------------

  /**
   * Records an event and returns its assigned id for O(1) lookup via getById(id).
   *
   * Note: If the event is a duplicate STATE_CHANGED (same signature as last), it is dropped
   * and this returns '' (sentinel) to keep compatibility with current call sites.
   */
  record(event: FlowTelemetryEvent): TelemetryId {
    const stateSig = isStateChangedEvent(event) ? stateChangedSignature(event) : null;
    if (stateSig != null && stateSig === this.lastStateChangedSig) return DROPPED_EVENT_ID;

    this.evictIfNeeded();

    const id = this.newId();
    this.append(id, event);

    if (stateSig != null) this.lastStateChangedSig = stateSig;

    return id;
  }

  /** O(1) lookup by id returned from record(event). */
  getById(id: TelemetryId): FlowTelemetryEvent | undefined {
    return this.byId.get(id);
  }

  /**
   * Returns a snapshot array of stored events (preserves internal ordering).
   * Snapshot protects internal storage from accidental external mutation.
   */
  getEvents(): readonly FlowTelemetryEvent[] {
    return this.entries.map(({ event }) => event);
  }

  // --- Queries ---------------------------------------------------------------

  /**
   * Finds the last event that matches the predicate.
   * @param predicate - A predicate function to filter by.
   * @returns The last event that matches the predicate or undefined if no event matches.
   *
   * @example
   * ```ts
   * const sink = new InMemoryFlowTelemetrySink();
   * sink.record({ kind: 'COMMAND_SENT', eventType: 'command_sent' });
   * sink.record({ kind: 'STATE_CHANGED', state: 'state_changed', tags: [] });
   *
   * console.log(sink.findLast((e) => e.kind === 'COMMAND_SENT'));
   * // { kind: 'COMMAND_SENT', eventType: 'command_sent' }
   *
   * console.log(sink.findLast((e) => e.kind === 'STATE_CHANGED'));
   * // { kind: 'STATE_CHANGED', state: 'state_changed', tags: [] }
   * ```
   */
  findLast(predicate: (e: FlowTelemetryEvent) => boolean): FlowTelemetryEvent | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const event = this.entries[i].event;
      if (predicate(event)) return event;
    }
    return undefined;
  }

  /**
   * @param predicateOrKind - A predicate function or a kind to filter by.
   * @returns The number of events that match the predicate or kind.
   *
   * @example
   * ```ts
   * const sink = new InMemoryFlowTelemetrySink();
   * sink.record({ kind: 'COMMAND_SENT', eventType: 'command_sent' });
   * sink.record({ kind: 'STATE_CHANGED', state: 'state_changed', tags: [] });
   *
   * console.log(sink.countEvents()); // 2
   * console.log(sink.countEvents((e) => e.kind === 'COMMAND_SENT')); // 1
   * console.log(sink.countEvents('COMMAND_SENT')); // 1
   * ```
   */
  countEvents(
    predicateOrKind?: ((e: FlowTelemetryEvent) => boolean) | FlowTelemetryEvent['kind'],
  ): number {
    if (predicateOrKind == null) return this.entries.length;

    const predicate =
      typeof predicateOrKind === 'function'
        ? predicateOrKind
        : (e: FlowTelemetryEvent) => e.kind === predicateOrKind;

    let total = 0;
    for (const { event } of this.entries) {
      if (predicate(event)) total++;
    }
    return total;
  }

  /** Back-compat alias. */
  count(
    predicateOrKind?: ((e: FlowTelemetryEvent) => boolean) | FlowTelemetryEvent['kind'],
  ): number {
    return this.countEvents(predicateOrKind);
  }

  /** Returns all events of the given kind (pure helper over existing storage). */
  ofKind(kind: FlowTelemetryEvent['kind']): FlowTelemetryEvent[] {
    const out: FlowTelemetryEvent[] = [];
    for (const { event } of this.entries) {
      if (event.kind === kind) out.push(event);
    }
    return out;
  }

  /** Returns the last event of the given kind, or undefined (pure helper over existing storage). */
  lastKind(kind: FlowTelemetryEvent['kind']): FlowTelemetryEvent | undefined {
    return this.findLast((e) => e.kind === kind);
  }

  // --- Internals -------------------------------------------------------------

  private evictIfNeeded(): void {
    if (this.entries.length < this.maxEvents) return;

    const removed = this.entries.shift();
    if (!removed) return;

    this.byId.delete(removed.id);

    // Note: We intentionally do NOT recompute lastStateChangedSig on eviction.
    // Dedupe is "best effort" based on last observed STATE_CHANGED at record() time.
  }

  private newId(): TelemetryId {
    this.nextId += 1;
    return String(this.nextId);
  }

  private append(id: TelemetryId, event: FlowTelemetryEvent): void {
    this.entries.push({ id, event });
    this.byId.set(id, event);
  }
}
