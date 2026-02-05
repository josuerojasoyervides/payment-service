import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { FakeScenario } from '@app/features/payments/infrastructure/fake/shared/types/fake-scenario.type';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

/**
 * Predefined errors for testing.
 */
export const FAKE_ERRORS: Record<FakeScenario, PaymentError> = {
  provider_error: {
    code: 'provider_error',
    messageKey: PAYMENT_ERROR_KEYS.PROVIDER_ERROR,
    raw: { scenario: 'provider_error' },
  },

  decline: {
    code: 'card_declined',
    messageKey: PAYMENT_ERROR_KEYS.CARD_DECLINED,
    raw: { scenario: 'decline' },
  },

  insufficient: {
    code: 'insufficient_funds',
    messageKey: PAYMENT_ERROR_KEYS.INSUFFICIENT_FUNDS,
    raw: { scenario: 'insufficient' },
  },

  expired: {
    code: 'expired_card',
    messageKey: PAYMENT_ERROR_KEYS.EXPIRED_CARD,
    raw: { scenario: 'expired' },
  },

  timeout: {
    code: 'timeout',
    messageKey: PAYMENT_ERROR_KEYS.TIMEOUT,
    raw: { scenario: 'timeout' },
  },
};
