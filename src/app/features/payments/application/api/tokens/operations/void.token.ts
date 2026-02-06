import { InjectionToken } from '@angular/core';
import type { VoidGatewayPort } from '@payments/application/api/ports/void-gateway.port';

export const VOID_GATEWAYS = new InjectionToken<VoidGatewayPort[]>('VOID_GATEWAYS', {
  factory: () => [],
});
