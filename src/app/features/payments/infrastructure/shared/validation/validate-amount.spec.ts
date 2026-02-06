import type { Money } from '@payments/domain/common/primitives/money/money.vo';
import type { ProviderValidationConfig } from '@payments/infrastructure/shared/validation/provider-validation-config.types';
import { validateAmount } from '@payments/infrastructure/shared/validation/validate-amount';

describe('validateAmount', () => {
  const baseConfig: ProviderValidationConfig = {
    providerId: 'stripe',
    method: 'card',
    currencies: ['MXN'],
    amountLimitsByCurrency: {
      MXN: { min: 10, max: 100 },
    },
  };

  it('throws currency_not_supported when currency is not allowed', () => {
    const money: Money = { amount: 50, currency: 'USD' as const };
    expect(() => validateAmount(money, baseConfig)).toThrowError(
      expect.objectContaining({ code: 'currency_not_supported' }),
    );
  });

  it('throws amount_below_minimum when amount is too low', () => {
    const money: Money = { amount: 5, currency: 'MXN' as const };
    expect(() => validateAmount(money, baseConfig)).toThrowError(
      expect.objectContaining({ code: 'amount_below_minimum' }),
    );
  });

  it('throws amount_above_maximum when amount exceeds max', () => {
    const money: Money = { amount: 101, currency: 'MXN' as const };
    expect(() => validateAmount(money, baseConfig)).toThrowError(
      expect.objectContaining({ code: 'amount_above_maximum' }),
    );
  });

  it('throws invalid_request when config is missing limits', () => {
    const money: Money = { amount: 50, currency: 'MXN' as const };
    const config: ProviderValidationConfig = {
      ...baseConfig,
      amountLimitsByCurrency: {},
    };

    expect(() => validateAmount(money, config)).toThrowError(
      expect.objectContaining({ code: 'invalid_request' }),
    );
  });
});
