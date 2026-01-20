import { Injectable, signal } from '@angular/core';
import { Translations } from './i18n.types';
import esTranslations from './translations/es.json';
import enTranslations from './translations/en.json';

/**
 * Servicio de internacionalización (i18n).
 * 
 * Proporciona traducciones centralizadas para toda la aplicación.
 * Soporta múltiples idiomas y cambio dinámico de idioma.
 * 
 * @example
 * ```typescript
 * // Inyectar el servicio
 * private readonly i18n = inject(I18nService);
 * 
 * // Obtener traducción
 * const message = this.i18n.t('errors.card_declined');
 * 
 * // Con parámetros
 * const message = this.i18n.t('errors.min_amount', { amount: 10, currency: 'MXN' });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
    /** Idioma actual (signal reactivo) */
    private readonly _currentLang = signal<string>('es');
    
    /** Traducciones disponibles */
    private readonly translationsMap: Record<string, Translations> = {
        es: esTranslations as Translations,
        en: enTranslations as Translations,
    };
    
    /** Traducciones cargadas */
    private get translations(): Translations {
        return this.translationsMap[this._currentLang()] || this.translationsMap['es'];
    }
    
    /** Idioma actual (readonly) */
    readonly currentLang = this._currentLang.asReadonly();
    
    /**
     * Obtiene una traducción por clave.
     * 
     * @param key Clave de traducción (ej: 'errors.card_declined')
     * @param params Parámetros opcionales para interpolación
     * @returns Texto traducido o la clave si no se encuentra
     */
    t(key: string, params?: Record<string, string | number>): string {
        const translation = this.getTranslation(key);
        
        if (!translation) {
            console.warn(`[I18n] Translation missing for key: ${key}`);
            return key;
        }
        
        // Interpolación de parámetros
        if (params) {
            return this.interpolate(translation, params);
        }
        
        return translation;
    }
    
    /**
     * Cambia el idioma actual.
     * 
     * @param lang Código de idioma (ej: 'es', 'en')
     */
    setLanguage(lang: string): void {
        if (this.translationsMap[lang]) {
            this._currentLang.set(lang);
        } else {
            console.warn(`[I18n] Language "${lang}" not available, keeping current language`);
        }
    }
    
    /**
     * Obtiene el idioma actual.
     */
    getLanguage(): string {
        return this._currentLang();
    }
    
    /**
     * Verifica si existe una traducción para una clave.
     */
    has(key: string): boolean {
        return this.getTranslation(key) !== undefined;
    }
    
    // ============================================================
    // MÉTODOS PRIVADOS
    // ============================================================
    
    /**
     * Obtiene una traducción del objeto de traducciones.
     */
    private getTranslation(key: string): string | undefined {
        const keys = key.split('.');
        let value: any = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined;
            }
        }
        
        return typeof value === 'string' ? value : undefined;
    }
    
    /**
     * Interpola parámetros en una cadena de texto.
     * 
     * @example
     * interpolate('Min amount: {{amount}} {{currency}}', { amount: 10, currency: 'MXN' })
     * // => 'Min amount: 10 MXN'
     */
    private interpolate(text: string, params: Record<string, string | number>): string {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key] !== undefined ? String(params[key]) : match;
        });
    }
}
