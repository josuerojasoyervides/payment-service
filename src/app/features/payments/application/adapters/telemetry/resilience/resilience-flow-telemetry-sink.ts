import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import type {
  FlowTelemetryEvent,
  FlowTelemetrySink,
} from '@payments/application/adapters/telemetry/types/flow-telemetry.types';
import { sanitizeForLogging } from '@payments/shared/logging/sanitize-for-logging.util';

type ResilienceEvent = Extract<FlowTelemetryEvent, { kind: 'RESILIENCE_EVENT' }>;

const WARN_EVENT_TYPES: ResilienceEvent['eventType'][] = [
  'CIRCUIT_OPENED',
  'RATE_LIMIT_HIT',
  'RETRY_EXHAUSTED',
];

@Injectable()
export class ResilienceFlowTelemetrySink implements FlowTelemetrySink {
  private readonly logger = inject(LoggerService);

  record(event: FlowTelemetryEvent): void {
    if (event.kind !== 'RESILIENCE_EVENT') return;

    const metadata = sanitizeForLogging({
      eventType: event.eventType,
      flowId: event.flowId,
      providerId: event.providerId,
      refs: event.refs,
      meta: event.meta,
      atMs: event.atMs,
    });

    const message = `Resilience ${event.eventType}`;
    const context = 'ResilienceTelemetry';

    if (WARN_EVENT_TYPES.includes(event.eventType)) {
      this.logger.warn(message, context, metadata);
      return;
    }

    this.logger.info(message, context, metadata);
  }
}
