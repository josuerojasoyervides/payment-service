import { inject, Injectable, signal } from '@angular/core';
import { LoggerService } from '@core/logging';

import { Translations } from './i18n.types';
import { en } from './translations/en';
import { es } from './translations/es';

/**
 * Internationalization (i18n) service.
 *
 * Provides centralized translations for the entire application.
 * Supports multiple languages and dynamic language switching.
 *
 * @example
 * ```typescript
 * import { I18nKeys } from '@core/i18n';
 *
 * private readonly i18n = inject(I18nService);
 *
 * const message = this.i18n.t(I18nKeys.errors.card_declined);
 * const message = this.i18n.t(I18nKeys.ui.loading);
 *
 * const message = this.i18n.t(I18nKeys.errors.min_amount, { amount: 10, currency: 'MXN' });
 *
 * const dynamicKey = `errors.${errorCode}`;
 * this.i18n.t(dynamicKey);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly logger = inject(LoggerService);

  private readonly _currentLang = signal<string>('es');
  private readonly translationsMap: Record<string, Translations> = { es, en };

  private get translations(): Translations {
    return this.translationsMap[this._currentLang()] || this.translationsMap['es'];
  }

  readonly currentLang = this._currentLang.asReadonly();

  /**
   * Gets a translation by key.
   *
   * @param key Translation key (e.g., 'errors.card_declined')
   * @param params Optional parameters for interpolation
   * @returns Translated text or the key if not found
   */
  t(key: string, params?: Record<string, string | number>): string {
    const translation = this.getTranslation(key);

    if (!translation) {
      this.logger.warn(`[I18n] Translation missing for key: ${key}`, 'I18nService', { key });
      return key;
    }

    if (params) {
      return this.interpolate(translation, params);
    }

    return translation;
  }

  /**
   * Changes the current language.
   *
   * @param lang Language code (e.g., 'es', 'en')
   */
  setLanguage(lang: string): void {
    if (this.translationsMap[lang]) {
      this._currentLang.set(lang);
    } else {
      this.logger.warn(
        `[I18n] Language "${lang}" not available, keeping current language`,
        'I18nService',
        { lang },
      );
    }
  }

  /**
   * Gets the current language.
   */
  getLanguage(): string {
    return this._currentLang();
  }

  /**
   * Checks if a translation exists for a key.
   *
   * @param key Translation key
   * @returns true if the key exists, false otherwise
   */
  has(key: string): boolean {
    return this.getTranslation(key) !== undefined;
  }

  private getTranslation(key: string): string | undefined {
    const keys = key.split('.');
    let value: unknown = this.translations;

    for (const k of keys) {
      if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, k)) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Interpolates parameters in a text string.
   *
   * @example
   * interpolate('Min amount: {{amount}} {{currency}}', { amount: 10, currency: 'MXN' })
   * // => 'Min amount: 10 MXN'
   */
  private interpolate(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
