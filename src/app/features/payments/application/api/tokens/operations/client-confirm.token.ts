import { InjectionToken } from '@angular/core';
import type { ClientConfirmPort } from '@payments/application/api/ports/client-confirm.port';

export const CLIENT_CONFIRM_PORTS = new InjectionToken<ClientConfirmPort[]>(
  'CLIENT_CONFIRM_PORTS',
  {
    factory: () => [],
  },
);
