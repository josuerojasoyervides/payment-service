import { InjectionToken } from '@angular/core';
import type { FlowTelemetrySink } from '@payments/application/adapters/telemetry/types/flow-telemetry.types';

/**
 * Token for a single flow telemetry sink.
 * Used to inject the composite sink into the flow machine.
 *
 * @access public
 * @example
 * ```ts
 * const sink = inject(FLOW_TELEMETRY_SINK);
 * sink.record({
 *   kind: 'COMMAND_SENT',
 *   eventType: 'PAYMENT_STARTED',
 *   atMs: Date.now(),
 * });
 * ```
 */
export const FLOW_TELEMETRY_SINK = new InjectionToken<FlowTelemetrySink>('FLOW_TELEMETRY_SINK');

/**
 * Token for multiple flow telemetry sinks.
 * @access internal
 * @example
 * ```ts
 * { provide: FLOW_TELEMETRY_SINKS, useClass: InMemoryFlowTelemetrySink, multi: true },
 * { provide: FLOW_TELEMETRY_SINKS, useClass: ConsoleFlowTelemetrySink, multi: true },
 * ```
 */
export const FLOW_TELEMETRY_SINKS = new InjectionToken<readonly FlowTelemetrySink[]>(
  'FLOW_TELEMETRY_SINKS',
  { factory: () => [] as readonly FlowTelemetrySink[] },
);
