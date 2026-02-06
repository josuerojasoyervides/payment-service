import type { ExternalNavigatorPort } from '@payments/application/api/ports/external-navigator.port';

export class BrowserExternalNavigator implements ExternalNavigatorPort {
  navigate(url: string): void {
    if (typeof window === 'undefined') return;
    window.location.href = url;
  }
}
