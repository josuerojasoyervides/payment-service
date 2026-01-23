import { inject } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

import { StripeErrorResponse } from '../dto/stripe.dto';

export class ErrorKeyMapper {
  private readonly i18n = inject(I18nService);

  mapErrorKey(error: StripeErrorResponse['error']): string {
    const errorKeyMap: Partial<Record<string, string>> = {
      card_declined: I18nKeys.errors.card_declined,
      expired_card: I18nKeys.errors.expired_card,
      incorrect_cvc: I18nKeys.errors.incorrect_cvc,
      processing_error: I18nKeys.errors.processing_error,
      incorrect_number: I18nKeys.errors.incorrect_number,
      authentication_required: I18nKeys.errors.authentication_required,
    };

    const translationKey = errorKeyMap[error.code];
    if (translationKey) {
      return this.i18n.t(translationKey);
    }

    return error.message ?? this.i18n.t(I18nKeys.errors.stripe_error);
  }
}
