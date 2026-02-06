import type { ExternalNavigatorPort } from '@payments/application/api/ports/external-navigator.port';

export class ThrowingExternalNavigator implements ExternalNavigatorPort {
  navigate(url: string): void {
    throw new Error(`[payments] External navigation requested without navigator wiring: ${url}`);
  }
}
