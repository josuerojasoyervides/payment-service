import { PaymentErrorCode } from "@payments/domain/models";

export const ERROR_CODE_MAP: Record<string, PaymentErrorCode> = {
    'card_declined': 'card_declined',
    'expired_card': 'card_declined',
    'incorrect_cvc': 'card_declined',
    'processing_error': 'provider_error',
    'incorrect_number': 'invalid_request',
    'invalid_expiry_month': 'invalid_request',
    'invalid_expiry_year': 'invalid_request',
    'authentication_required': 'requires_action',
} as const;