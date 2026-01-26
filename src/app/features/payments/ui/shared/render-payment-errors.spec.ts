import { I18nKeys, I18nService } from '@core/i18n';

import { renderPaymentError } from './render-payment-errors';

describe('renderPaymentError', () => {
  it('returns unknown_error when error is null', () => {
    const i18n = { t: (key: string) => key } as I18nService;
    expect(renderPaymentError(i18n, null)).toBe(I18nKeys.errors.unknown_error);
  });

  it('returns translated message for valid messageKey', () => {
    const i18n = { t: (key: string) => key } as I18nService;
    const error = { messageKey: I18nKeys.errors.card_declined };
    expect(renderPaymentError(i18n, error)).toBe(I18nKeys.errors.card_declined);
  });

  it('rejects Error.message even if it looks like a key', () => {
    const i18n = { t: (key: string) => key } as I18nService;
    const err = new Error(I18nKeys.errors.card_declined);
    expect(renderPaymentError(i18n, err)).toBe(I18nKeys.errors.unknown_error);
  });

  it('rejects non-key messageKey values', () => {
    const i18n = { t: (key: string) => key } as I18nService;
    const error = { messageKey: 'human readable error' };
    expect(renderPaymentError(i18n, error)).toBe(I18nKeys.errors.unknown_error);
  });

  it('sanitizes params before calling i18n', () => {
    const t = vi.fn((key: string) => key);
    const i18n = { t } as unknown as I18nService;
    const error = {
      messageKey: I18nKeys.errors.min_amount,
      params: { amount: 10, currency: 'MXN', ok: true, extra: { nested: 1 } },
    };

    renderPaymentError(i18n, error);

    expect(t).toHaveBeenCalledWith(I18nKeys.errors.min_amount, {
      amount: 10,
      currency: 'MXN',
      ok: 'true',
    });
  });
});
