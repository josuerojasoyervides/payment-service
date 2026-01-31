import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { FakeScenario } from '@app/features/payments/infrastructure/fake/shared/types/fake-scenario.type';
import { I18nKeys } from '@core/i18n';

/**
 * Predefined errors for testing.
 */
export const FAKE_ERRORS: Record<FakeScenario, PaymentError> = {
  provider_error: {
    code: 'provider_error',
    messageKey: I18nKeys.errors.provider_error,
    raw: { scenario: 'provider_error' },
  },

  decline: {
    code: 'card_declined',
    messageKey: I18nKeys.errors.card_declined,
    raw: { scenario: 'decline' },
  },

  insufficient: {
    code: 'insufficient_funds',
    messageKey: I18nKeys.errors.insufficient_funds,
    raw: { scenario: 'insufficient' },
  },

  expired: {
    code: 'expired_card',
    messageKey: I18nKeys.errors.expired_card,
    raw: { scenario: 'expired' },
  },

  timeout: {
    code: 'timeout',
    messageKey: I18nKeys.errors.timeout,
    raw: { scenario: 'timeout' },
  },
};
