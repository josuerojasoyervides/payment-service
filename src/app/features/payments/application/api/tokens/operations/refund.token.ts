import { InjectionToken } from '@angular/core';
import type { RefundGatewayPort } from '@payments/application/api/ports/refund-gateway.port';

export const REFUND_GATEWAYS = new InjectionToken<RefundGatewayPort[]>('REFUND_GATEWAYS', {
  factory: () => [],
});
