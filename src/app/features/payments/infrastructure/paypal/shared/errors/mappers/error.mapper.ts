import type { PaymentErrorCode } from '@payments/domain/subdomains/payment/contracts/payment-error.types';

export const ERROR_MAP: Record<string, PaymentErrorCode> = {
  INVALID_REQUEST: 'invalid_request',
  PERMISSION_DENIED: 'provider_error',
  RESOURCE_NOT_FOUND: 'invalid_request',
  UNPROCESSABLE_ENTITY: 'invalid_request',
  INSTRUMENT_DECLINED: 'card_declined',
  ORDER_NOT_APPROVED: 'requires_action',
  INTERNAL_SERVICE_ERROR: 'provider_unavailable',
} as const;
