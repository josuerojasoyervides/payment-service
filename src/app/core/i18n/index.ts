/**
 * Módulo de Internacionalización (i18n)
 *
 * Proporciona traducciones centralizadas para toda la aplicación.
 *
 * @example
 * ```typescript
 * import { I18nService, I18nKeys } from '@core/i18n';
 *
 * // En un componente o servicio
 * private readonly i18n = inject(I18nService);
 *
 * // Uso recomendado: con I18nKeys (autocompletado completo)
 * const message = this.i18n.t(I18nKeys.errors.card_declined);
 * const message = this.i18n.t(I18nKeys.ui.loading);
 * ```
 */

export * from './i18n.keys';
export * from './i18n.service';
export * from './i18n.types';
