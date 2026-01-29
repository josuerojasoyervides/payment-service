import type { Provider } from '@angular/core';

export type PaymentsProvidersMode = 'fake' | 'real';

export interface PaymentsProvidersOptions {
  mode?: PaymentsProvidersMode;
  extraProviders?: Provider[];
}
