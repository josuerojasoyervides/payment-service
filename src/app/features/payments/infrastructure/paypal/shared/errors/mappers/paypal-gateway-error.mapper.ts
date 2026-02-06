import { HttpErrorResponse } from '@angular/common/http';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentErrorCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaypalErrorResponse } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { TimeoutError } from 'rxjs';

import { ERROR_MAP } from './error.mapper';

function isPaypalErrorResponse(value: unknown): value is PaypalErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const name = (value as Record<string, unknown>)['name'];
  return typeof name === 'string' && name.length > 0;
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

export function mapPaypalGatewayError(err: unknown, timeoutMs: number): PaymentError {
  if (isPaymentErrorLike(err)) return err;

  if (err instanceof TimeoutError) {
    return {
      code: 'timeout',
      raw: { reason: 'timeout', timeoutMs },
    };
  }

  if (err instanceof HttpErrorResponse) {
    let mappedCode: PaymentErrorCode;
    let name: string | null = null;
    let debugId: string | null = null;

    if (isPaypalErrorResponse(err.error)) {
      name = err.error.name;
      debugId = err.error.debug_id ?? null;
      mappedCode = ERROR_MAP[name] ?? mapHttpStatusToCode(err.status);
    } else {
      mappedCode = mapHttpStatusToCode(err.status);
    }

    return {
      code: mappedCode,
      raw: {
        provider: PAYMENT_PROVIDER_IDS.paypal,
        status: err.status,
        name,
        debugId,
      },
    };
  }

  return {
    code: 'provider_error',
    raw: {
      provider: PAYMENT_PROVIDER_IDS.paypal,
      reason: 'unexpected_error',
    },
  };
}
