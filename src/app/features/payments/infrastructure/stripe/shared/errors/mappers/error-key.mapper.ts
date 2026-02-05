import type { StripeErrorResponse } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

export class ErrorKeyMapper {
  mapErrorKey(error: StripeErrorResponse['error']): string {
    const errorKeyMap: Partial<Record<string, string>> = {
      card_declined: PAYMENT_ERROR_KEYS.CARD_DECLINED,
      expired_card: PAYMENT_ERROR_KEYS.EXPIRED_CARD,
      incorrect_cvc: PAYMENT_ERROR_KEYS.INCORRECT_CVC,
      processing_error: PAYMENT_ERROR_KEYS.PROCESSING_ERROR,
      incorrect_number: PAYMENT_ERROR_KEYS.INCORRECT_NUMBER,
      authentication_required: PAYMENT_ERROR_KEYS.AUTHENTICATION_REQUIRED,
    };

    const translationKey = errorKeyMap[error.code];
    if (translationKey) {
      return translationKey;
    }

    return PAYMENT_ERROR_KEYS.STRIPE_ERROR;
  }
}
