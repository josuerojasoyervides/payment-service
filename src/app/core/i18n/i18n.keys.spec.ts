import { I18nKeys } from '@core/i18n/i18n.keys';
import { en } from '@core/i18n/translations/en';
import { describe, expect, it } from 'vitest';

describe('I18nKeys', () => {
  describe('buildKeys function', () => {
    it('should generate correct key paths for nested objects', () => {
      expect(I18nKeys).toBeDefined();
      expect(I18nKeys.errors).toBeDefined();
      expect(I18nKeys.messages).toBeDefined();
      expect(I18nKeys.ui).toBeDefined();
    });

    it('should generate correct paths for errors keys', () => {
      expect(I18nKeys.errors.card_declined).toBe('errors.card_declined');
      expect(I18nKeys.errors.expired_card).toBe('errors.expired_card');
      expect(I18nKeys.errors.provider_error).toBe('errors.provider_error');
      expect(I18nKeys.errors.min_amount).toBe('errors.min_amount');
      expect(I18nKeys.errors.stripe_error).toBe('errors.stripe_error');
      expect(I18nKeys.errors.paypal_error).toBe('errors.paypal_error');
    });

    it('should generate correct paths for messages keys', () => {
      expect(I18nKeys.messages.payment_created).toBe('messages.payment_created');
      expect(I18nKeys.messages.payment_confirmed).toBe('messages.payment_confirmed');
      expect(I18nKeys.messages.status_succeeded).toBe('messages.status_succeeded');
      expect(I18nKeys.messages.spei_instructions).toBe('messages.spei_instructions');
    });

    it('should generate correct paths for ui keys', () => {
      expect(I18nKeys.ui.loading).toBe('ui.loading');
      expect(I18nKeys.ui.error).toBe('ui.error');
      expect(I18nKeys.ui.checkout).toBe('ui.checkout');
      expect(I18nKeys.ui.payment_provider).toBe('ui.payment_provider');
      expect(I18nKeys.ui['3ds_verification_required']).toBe('ui.3ds_verification_required');
    });

    it('should have all keys from en translations', () => {
      const checkKeys = (obj: any, keys: any, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fullPath = prefix ? `${prefix}.${key}` : key;
          expect(keys).toHaveProperty(key);

          if (value && typeof value === 'object' && !Array.isArray(value)) {
            checkKeys(value, keys[key], fullPath);
          } else {
            expect(keys[key]).toBe(fullPath);
          }
        }
      };

      checkKeys(en, I18nKeys);
    });

    it('should have same structure as en translations', () => {
      const getKeys = (obj: any): string[] => {
        return Object.keys(obj).sort();
      };

      expect(getKeys(I18nKeys)).toEqual(getKeys(en));
      expect(getKeys(I18nKeys.errors)).toEqual(getKeys(en.errors));
      expect(getKeys(I18nKeys.messages)).toEqual(getKeys(en.messages));
      expect(getKeys(I18nKeys.ui)).toEqual(getKeys(en.ui));
    });

    it('should generate paths with correct depth', () => {
      const checkDepth = (obj: any, expectedPrefix: string) => {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            const parts = value.split('.');
            expect(parts.length).toBe(2);
            expect(parts[0]).toBe(expectedPrefix);
            expect(parts[1]).toBe(key);
          } else if (typeof value === 'object') {
            checkDepth(value, expectedPrefix);
          }
        }
      };

      checkDepth(I18nKeys.errors, 'errors');
      checkDepth(I18nKeys.messages, 'messages');
      checkDepth(I18nKeys.ui, 'ui');
    });
  });

  describe('I18nKeys usage', () => {
    it('should be usable with I18nService.t()', () => {
      expect(typeof I18nKeys.errors.card_declined).toBe('string');
      expect(typeof I18nKeys.ui.loading).toBe('string');
      expect(typeof I18nKeys.messages.payment_created).toBe('string');
    });

    it('should have all required error keys', () => {
      const requiredErrorKeys = [
        'provider_error',
        'card_declined',
        'expired_card',
        'min_amount',
        'stripe_error',
        'paypal_error',
        'order_id_required',
        'currency_required',
      ] as const;

      requiredErrorKeys.forEach((key) => {
        expect(I18nKeys.errors).toHaveProperty(key);
        expect(I18nKeys.errors[key]).toBe(`errors.${key}`);
      });
    });

    it('should have all required ui keys', () => {
      const requiredUiKeys = [
        'loading',
        'error',
        'cancel',
        'confirm',
        'checkout',
        'payment_provider',
        'payment_method',
      ] as const;

      requiredUiKeys.forEach((key) => {
        expect(I18nKeys.ui).toHaveProperty(key);
        expect(I18nKeys.ui[key]).toBe(`ui.${key}`);
      });
    });
  });
});
