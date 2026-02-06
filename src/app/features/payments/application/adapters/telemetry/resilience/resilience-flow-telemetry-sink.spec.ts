import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging/logger.service';
import type { FlowTelemetryEvent } from '@payments/application/adapters/telemetry/types/flow-telemetry.types';

import { ResilienceFlowTelemetrySink } from './resilience-flow-telemetry-sink';

describe('ResilienceFlowTelemetrySink', () => {
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    loggerMock.info.mockClear();
    loggerMock.warn.mockClear();
  });

  it('ignores non-resilience events', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: loggerMock }, ResilienceFlowTelemetrySink],
    });
    const sink = TestBed.inject(ResilienceFlowTelemetrySink);
    const event: FlowTelemetryEvent = {
      kind: 'COMMAND_SENT',
      eventType: 'START',
      atMs: 10,
      flowId: 'flow_1',
    };

    sink.record(event);

    expect(loggerMock.info).not.toHaveBeenCalled();
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });

  it('logs resilience events with sanitized metadata', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: loggerMock }, ResilienceFlowTelemetrySink],
    });
    const sink = TestBed.inject(ResilienceFlowTelemetrySink);
    const event: FlowTelemetryEvent = {
      kind: 'RESILIENCE_EVENT',
      eventType: 'CIRCUIT_OPENED',
      atMs: 20,
      flowId: 'flow_2',
      providerId: 'stripe',
      meta: {
        token: 'tok_secret',
        attemptNumber: 2,
      },
    };

    sink.record(event);

    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
    const [, , metadata] = loggerMock.warn.mock.calls[0];
    expect(metadata).toMatchObject({
      eventType: 'CIRCUIT_OPENED',
      flowId: 'flow_2',
      providerId: 'stripe',
      meta: {
        token: '[REDACTED]',
        attemptNumber: 2,
      },
    });
  });
});
