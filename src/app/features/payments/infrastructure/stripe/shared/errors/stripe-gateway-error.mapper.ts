import { HttpErrorResponse } from '@angular/common/http';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentErrorCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import { isStripeErrorResponse } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { isPaymentErrorLike } from '@app/features/payments/infrastructure/stripe/shared/errors/payment-error.schema';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { TimeoutError } from 'rxjs';
import { match } from 'ts-pattern';

import { mapStripeCodeToPaymentErrorCode } from './stripe-error-code.mapper';

const mapHttpStatusToCode = (status: number): PaymentErrorCode =>
  match(status)
    .returnType<PaymentErrorCode>()
    .with(0, () => 'network_error')
    .with(408, 504, () => 'timeout')
    .with(500, () => 'provider_unavailable')
    .with(400, () => 'invalid_request')
    .otherwise(() => 'provider_error');

export function mapStripeGatewayError(err: unknown, timeoutMs: number): PaymentError {
  return match(err)
    .returnType<PaymentError>()
    .when(isPaymentErrorLike, (e) => e)
    .when(
      (e): e is TimeoutError => e instanceof TimeoutError,
      () => ({
        code: 'timeout',
        raw: {
          provider: PAYMENT_PROVIDER_IDS.stripe,
          reason: 'timeout',
          timeoutMs,
        },
      }),
    )
    .when(
      (e): e is HttpErrorResponse => e instanceof HttpErrorResponse,
      (httpErr) => {
        const fallbackCode = mapHttpStatusToCode(httpErr.status);

        return match(httpErr.error)
          .returnType<PaymentError>()
          .when(isStripeErrorResponse, (stripeErr) => {
            const stripeCode = stripeErr.error.code ?? null;
            const stripeType = stripeErr.error.type ?? null;

            const mapped = mapStripeCodeToPaymentErrorCode(stripeCode);

            return {
              code: mapped ?? fallbackCode,
              raw: {
                provider: PAYMENT_PROVIDER_IDS.stripe,
                status: httpErr.status,
                stripe: { code: stripeCode, type: stripeType },
              },
            };
          })
          .otherwise(() => ({
            code: fallbackCode,
            raw: {
              provider: PAYMENT_PROVIDER_IDS.stripe,
              status: httpErr.status,
              reason: 'http_error_non_stripe_shape',
            },
          }));
      },
    )
    .otherwise(() => ({
      code: 'provider_error',
      raw: {
        provider: PAYMENT_PROVIDER_IDS.stripe,
        reason: 'unexpected_error',
      },
    }));
}
