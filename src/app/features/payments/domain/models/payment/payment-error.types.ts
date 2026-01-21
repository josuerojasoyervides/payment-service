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

export function fallbackHandledError(raw?: unknown): PaymentError {
    return {
        code: 'fallback_handled',
        message: 'Fallback handled',
        raw,
    };
}