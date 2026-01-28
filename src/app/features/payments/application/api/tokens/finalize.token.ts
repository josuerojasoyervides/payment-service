import { InjectionToken } from '@angular/core';
import type { FinalizePort } from '@payments/application/api/ports/finalize.port';

export const FINALIZE_PORTS = new InjectionToken<FinalizePort[]>('FINALIZE_PORTS', {
  factory: () => [],
});
