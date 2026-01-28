import { InjectionToken } from '@angular/core';

import { ClientConfirmPort } from '../ports/client-confirm.port';

export const CLIENT_CONFIRM_PORTS = new InjectionToken<ClientConfirmPort[]>(
  'CLIENT_CONFIRM_PORTS',
  {
    factory: () => [],
  },
);
