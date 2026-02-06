import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { FakeScenario } from '@app/features/payments/infrastructure/fake/shared/types/fake-scenario.type';

/**
 * Predefined errors for testing.
 */
export const FAKE_ERRORS: Record<FakeScenario, PaymentError> = {
  provider_error: {
    code: 'provider_error',
    raw: { scenario: 'provider_error' },
  },

  decline: {
    code: 'card_declined',
    raw: { scenario: 'decline' },
  },

  insufficient: {
    code: 'insufficient_funds',
    raw: { scenario: 'insufficient' },
  },

  expired: {
    code: 'expired_card',
    raw: { scenario: 'expired' },
  },

  timeout: {
    code: 'timeout',
    raw: { scenario: 'timeout' },
  },

  circuit_open: {
    code: 'circuit_open',
    raw: { scenario: 'circuit_open' },
  },

  rate_limited: {
    code: 'rate_limited',
    raw: { scenario: 'rate_limited' },
  },
};
