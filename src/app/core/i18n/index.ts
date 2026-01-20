/**
 * Módulo de Internacionalización (i18n)
 * 
 * Proporciona traducciones centralizadas para toda la aplicación.
 * 
 * @example
 * ```typescript
 * import { I18nService } from '@core/i18n';
 * 
 * // En un componente o servicio
 * private readonly i18n = inject(I18nService);
 * const message = this.i18n.t('errors.card_declined');
 * ```
 */

export * from './i18n.service';
export * from './i18n.types';
