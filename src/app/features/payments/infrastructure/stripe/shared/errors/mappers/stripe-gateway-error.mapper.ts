import { HttpErrorResponse } from '@angular/common/http';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentErrorCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { StripeErrorResponse } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { TimeoutError } from 'rxjs';

import { ERROR_CODE_MAP } from './error-code.mapper';

function isStripeErrorResponse(value: unknown): value is StripeErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const error = (value as Record<string, unknown>)['error'];
  if (!error || typeof error !== 'object') return false;
  return typeof (error as Record<string, unknown>)['code'] === 'string';
}

function mapHttpStatusToCode(status: number): PaymentErrorCode {
  if (status === 0) return 'network_error';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'provider_unavailable';
  if (status >= 400) return 'invalid_request';
  return 'provider_error';
}

function isPaymentErrorLike(value: unknown): value is PaymentError {
  return !!value && typeof value === 'object' && 'code' in value;
}

export function mapStripeGatewayError(err: unknown, timeoutMs: number): PaymentError {
  if (isPaymentErrorLike(err)) return err;

  if (err instanceof TimeoutError) {
    return {
      code: 'timeout',
      raw: { reason: 'timeout', timeoutMs },
    };
  }

  if (err instanceof HttpErrorResponse) {
    let mappedCode: PaymentErrorCode;
    let stripeCode: string | null = null;
    let stripeType: string | null = null;

    if (isStripeErrorResponse(err.error)) {
      stripeCode = err.error.error.code;
      stripeType = err.error.error.type ?? null;
      mappedCode = ERROR_CODE_MAP[stripeCode] ?? mapHttpStatusToCode(err.status);
    } else {
      mappedCode = mapHttpStatusToCode(err.status);
    }

    return {
      code: mappedCode,
      raw: {
        provider: 'stripe',
        status: err.status,
        code: stripeCode,
        type: stripeType,
      },
    };
  }

  return {
    code: 'provider_error',
    raw: err,
  };
}
