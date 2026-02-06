import { InjectionToken } from '@angular/core';
import type { CaptureGatewayPort } from '@payments/application/api/ports/capture-gateway.port';

export const CAPTURE_GATEWAYS = new InjectionToken<CaptureGatewayPort[]>('CAPTURE_GATEWAYS', {
  factory: () => [],
});
