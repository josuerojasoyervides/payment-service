import { InjectionToken } from '@angular/core';

import type { FlowTelemetrySink } from './flow-telemetry.types';

export const FLOW_TELEMETRY_SINK = new InjectionToken<FlowTelemetrySink>('FLOW_TELEMETRY_SINK');
