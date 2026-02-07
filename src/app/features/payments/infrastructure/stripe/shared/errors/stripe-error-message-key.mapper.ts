import type { StripeErrorResponse } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { match } from 'ts-pattern';

export const mapStripeErrorToMessageKey = (error: StripeErrorResponse['error']): string =>
  match(error.code)
    .with('card_declined', () => PAYMENT_ERROR_KEYS.CARD_DECLINED)
    .with('expired_card', () => PAYMENT_ERROR_KEYS.EXPIRED_CARD)
    .with('incorrect_cvc', () => PAYMENT_ERROR_KEYS.INCORRECT_CVC)
    .with('processing_error', () => PAYMENT_ERROR_KEYS.PROCESSING_ERROR)
    .with('incorrect_number', () => PAYMENT_ERROR_KEYS.INCORRECT_NUMBER)
    .with('authentication_required', () => PAYMENT_ERROR_KEYS.AUTHENTICATION_REQUIRED)
    .otherwise(() => PAYMENT_ERROR_KEYS.STRIPE_ERROR);
