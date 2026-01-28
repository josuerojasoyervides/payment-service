import { InjectionToken } from '@angular/core';

import type { FinalizePort } from '../ports/finalize.port';

export const FINALIZE_PORTS = new InjectionToken<FinalizePort[]>('FINALIZE_PORTS', {
  factory: () => [],
});
