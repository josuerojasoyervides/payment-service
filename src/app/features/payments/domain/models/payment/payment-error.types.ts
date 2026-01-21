export type PaymentErrorCode =
    | 'invalid_request'
    | 'card_declined'
    | 'requires_action'
    | 'provider_unavailable'
    | 'provider_error'
    | 'unknown_error'
    | 'fallback_handled';

export interface PaymentError {
    code: PaymentErrorCode;
    message: string;
    raw: unknown;
}