import { InjectionToken } from '@angular/core';
import type { FlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/types/flow-telemetry.types';

export const FLOW_TELEMETRY_SINK = new InjectionToken<FlowTelemetrySink>('FLOW_TELEMETRY_SINK');
