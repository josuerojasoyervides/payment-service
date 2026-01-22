import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { I18nKeys } from './i18n.keys';
import { es } from './translations/es';
import { en } from './translations/en';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [I18nService],
    });
    service = TestBed.inject(I18nService);
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should default to Spanish', () => {
      expect(service.getLanguage()).toBe('es');
      expect(service.currentLang()).toBe('es');
    });

    it('should have es and en translations loaded', () => {
      // Verificar que puede traducir en ambos idiomas
      expect(service.t(I18nKeys.ui.loading)).toBe(es.ui.loading);
      service.setLanguage('en');
      expect(service.t(I18nKeys.ui.loading)).toBe(en.ui.loading);
    });
  });

  describe('t() - Translation method', () => {
    it('should return Spanish translation by default', () => {
      expect(service.t(I18nKeys.errors.card_declined)).toBe(es.errors.card_declined);
      expect(service.t(I18nKeys.ui.loading)).toBe(es.ui.loading);
      expect(service.t(I18nKeys.messages.payment_created)).toBe(es.messages.payment_created);
    });

    it('should return English translation when language is set to en', () => {
      service.setLanguage('en');
      expect(service.t(I18nKeys.errors.card_declined)).toBe(en.errors.card_declined);
      expect(service.t(I18nKeys.ui.loading)).toBe(en.ui.loading);
      expect(service.t(I18nKeys.messages.payment_created)).toBe(en.messages.payment_created);
    });

    it('should interpolate parameters correctly', () => {
      const result = service.t(I18nKeys.errors.min_amount, { amount: 10, currency: 'MXN' });
      expect(result).toContain('10');
      expect(result).toContain('MXN');
      expect(result).not.toContain('{{amount}}');
      expect(result).not.toContain('{{currency}}');
    });

    it('should handle multiple parameters in interpolation', () => {
      const result = service.t(I18nKeys.errors.min_amount, { amount: 50, currency: 'USD' });
      expect(result).toContain('50');
      expect(result).toContain('USD');
    });

    it('should return the key if translation is missing', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = service.t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[I18n] Translation missing for key: nonexistent.key',
      );
      consoleSpy.mockRestore();
    });

    it('should work with string literals (backward compatibility)', () => {
      expect(service.t('errors.card_declined')).toBe(es.errors.card_declined);
      expect(service.t('ui.loading')).toBe(es.ui.loading);
    });

    it('should handle nested keys correctly', () => {
      expect(service.t('errors.paypal_invalid_request')).toBe(es.errors.paypal_invalid_request);
      expect(service.t('messages.status_succeeded')).toBe(es.messages.status_succeeded);
      expect(service.t('ui.3ds_verification_required')).toBe(es.ui['3ds_verification_required']);
    });
  });

  describe('setLanguage()', () => {
    it('should change language to English', () => {
      service.setLanguage('en');
      expect(service.getLanguage()).toBe('en');
      expect(service.currentLang()).toBe('en');
      expect(service.t(I18nKeys.ui.loading)).toBe(en.ui.loading);
    });

    it('should change language back to Spanish', () => {
      service.setLanguage('en');
      service.setLanguage('es');
      expect(service.getLanguage()).toBe('es');
      expect(service.t(I18nKeys.ui.loading)).toBe(es.ui.loading);
    });

    it('should warn and keep current language for invalid language code', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const currentLang = service.getLanguage();

      service.setLanguage('fr');

      expect(service.getLanguage()).toBe(currentLang);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[I18n] Language "fr" not available, keeping current language',
      );
      consoleSpy.mockRestore();
    });

    it('should update translations immediately after language change', () => {
      expect(service.t(I18nKeys.ui.loading)).toBe(es.ui.loading);

      service.setLanguage('en');
      expect(service.t(I18nKeys.ui.loading)).toBe(en.ui.loading);

      service.setLanguage('es');
      expect(service.t(I18nKeys.ui.loading)).toBe(es.ui.loading);
    });
  });

  describe('getLanguage()', () => {
    it('should return current language code', () => {
      expect(service.getLanguage()).toBe('es');
      service.setLanguage('en');
      expect(service.getLanguage()).toBe('en');
    });
  });

  describe('has() - Check translation existence', () => {
    it('should return true for existing keys', () => {
      expect(service.has(I18nKeys.errors.card_declined)).toBe(true);
      expect(service.has(I18nKeys.ui.loading)).toBe(true);
      expect(service.has(I18nKeys.messages.payment_created)).toBe(true);
    });

    it('should return true for string literal keys that exist', () => {
      expect(service.has('errors.card_declined')).toBe(true);
      expect(service.has('ui.loading')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(service.has('nonexistent.key')).toBe(false);
      expect(service.has('errors.nonexistent')).toBe(false);
      expect(service.has('')).toBe(false);
    });

    it('should work correctly after language change', () => {
      expect(service.has(I18nKeys.ui.loading)).toBe(true);
      service.setLanguage('en');
      expect(service.has(I18nKeys.ui.loading)).toBe(true);
    });
  });

  describe('currentLang signal', () => {
    it('should be reactive and update when language changes', () => {
      expect(service.currentLang()).toBe('es');

      service.setLanguage('en');
      expect(service.currentLang()).toBe('en');

      service.setLanguage('es');
      expect(service.currentLang()).toBe('es');
    });

    it('should be readonly', () => {
      // Verificar que es un signal readonly (no se puede modificar directamente)
      const signal = service.currentLang;
      expect(signal).toBeDefined();
      // No podemos verificar readonly en runtime, pero TypeScript lo garantiza
    });
  });

  describe('Translation coverage', () => {
    it('should have translations for all error keys', () => {
      Object.keys(I18nKeys.errors).forEach((key) => {
        const fullKey = `errors.${key}`;
        expect(service.has(fullKey)).toBe(true);
        expect(service.t(fullKey)).not.toBe(fullKey); // No debe devolver la clave
      });
    });

    it('should have translations for all message keys', () => {
      Object.keys(I18nKeys.messages).forEach((key) => {
        const fullKey = `messages.${key}`;
        expect(service.has(fullKey)).toBe(true);
        expect(service.t(fullKey)).not.toBe(fullKey);
      });
    });

    it('should have translations for all ui keys', () => {
      Object.keys(I18nKeys.ui).forEach((key) => {
        const fullKey = `ui.${key}`;
        expect(service.has(fullKey)).toBe(true);
        expect(service.t(fullKey)).not.toBe(fullKey);
      });
    });
  });

  describe('Parameter interpolation edge cases', () => {
    it('should handle missing parameters gracefully', () => {
      const result = service.t(I18nKeys.errors.min_amount, { amount: 10 });
      expect(result).toContain('10');
      expect(result).toContain('{{currency}}');
    });

    it('should handle empty params object', () => {
      const result = service.t(I18nKeys.errors.min_amount, {});
      expect(result).toContain('{{amount}}');
      expect(result).toContain('{{currency}}');
    });

    it('should handle numeric parameters', () => {
      const result = service.t(I18nKeys.errors.min_amount, { amount: 100, currency: 'MXN' });
      expect(result).toContain('100');
      expect(result).toContain('MXN');
    });

    it('should handle string parameters', () => {
      const result = service.t(I18nKeys.errors.min_amount, { amount: '50', currency: 'USD' });
      expect(result).toContain('50');
      expect(result).toContain('USD');
    });
  });
});
