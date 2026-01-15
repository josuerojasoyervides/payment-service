export type PaymentErrorCode =
    | 'invalid_request'
    | 'card_declined'
    | 'requires_action'
    | 'provider_unavailable'
    | 'provider_error';

export interface PaymentError {
    code: PaymentErrorCode;
    message: string;
    raw: unknown;
}