import { InjectionToken } from '@angular/core';

import { FinalizePort } from '../ports/finalize.port';

export const FINALIZE_PORTS = new InjectionToken<FinalizePort[]>('FINALIZE_PORTS', {
  factory: () => [],
});
