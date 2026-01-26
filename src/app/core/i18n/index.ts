/**
 * Internationalization module (i18n).
 *
 * Provides centralized translations for the application.
 *
 * @example
 * ```typescript
 * import { I18nService, I18nKeys } from '@core/i18n';
 *
 * // In a component or service
 * private readonly i18n = inject(I18nService);
 *
 * // Recommended usage: I18nKeys (full autocomplete)
 * const message = this.i18n.t(I18nKeys.errors.card_declined);
 * const message = this.i18n.t(I18nKeys.ui.loading);
 * ```
 */

export * from './i18n.keys';
export * from './i18n.pipe';
export * from './i18n.service';
export * from './i18n.types';
