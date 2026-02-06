import type { ExternalNavigatorPort } from '@payments/application/api/ports/external-navigator.port';

export class NoopExternalNavigator implements ExternalNavigatorPort {
  private warned = false;

  navigate(_url: string): void {
    if (this.warned) return;
    this.warned = true;
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[payments] External navigation requested but NoopExternalNavigator is active');
    }
  }
}
