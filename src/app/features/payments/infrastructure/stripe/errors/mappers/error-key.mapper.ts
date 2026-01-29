import { I18nKeys } from '@core/i18n';
import type { StripeErrorResponse } from '@payments/infrastructure/stripe/dto/stripe.dto';

export class ErrorKeyMapper {
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
      return translationKey;
    }

    return I18nKeys.errors.stripe_error;
  }
}
