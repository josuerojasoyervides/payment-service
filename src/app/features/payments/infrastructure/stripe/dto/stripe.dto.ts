/**
 * DTOs basados en la API real de Stripe
 * @see https://stripe.com/docs/api/payment_intents
 */

export interface StripePaymentIntentDto {
    id: string;                          // pi_1234567890
    object: 'payment_intent';
    amount: number;                      // En centavos (ej: 10000 = $100.00)
    amount_received: number;
    currency: string;                    // 'mxn', 'usd'
    status: StripePaymentIntentStatus;
    client_secret: string;               // pi_xxx_secret_xxx
    created: number;                     // Unix timestamp
    livemode: boolean;

    // Metadata opcional
    metadata?: Record<string, string>;
    description?: string;

    // Para 3DS y acciones requeridas
    next_action?: StripeNextAction | null;

    // Método de pago
    payment_method?: string | null;      // pm_1234567890
    payment_method_types: string[];      // ['card']

    // Información de error
    last_payment_error?: StripePaymentError | null;

    // Configuración
    capture_method: 'automatic' | 'manual';
    confirmation_method: 'automatic' | 'manual';

    // Recibo
    receipt_email?: string | null;
}

export type StripePaymentIntentStatus =
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'canceled'
    | 'succeeded';

export interface StripeNextAction {
    type: 'redirect_to_url' | 'use_stripe_sdk';
    redirect_to_url?: {
        url: string;
        return_url: string;
    };
    use_stripe_sdk?: {
        type: string;
        stripe_js: string;
    };
}

export interface StripePaymentError {
    code: string;
    doc_url: string;
    message: string;
    param?: string;
    type: 'api_error' | 'card_error' | 'idempotency_error' | 'invalid_request_error';
    charge?: string;
    decline_code?: string;
    payment_method?: {
        id: string;
        type: string;
    };
}

export interface StripeCreateIntentRequest {
    amount: number;
    currency: string;
    payment_method_types: string[];
    payment_method?: string;
    metadata?: Record<string, string>;
    description?: string;
    receipt_email?: string;
    capture_method?: 'automatic' | 'manual';
    confirm?: boolean;
    return_url?: string;
}

export interface StripeConfirmIntentRequest {
    payment_method?: string;
    return_url?: string;
}

// SPEI específico de Stripe México (OXXO/SPEI vía Sources)
export interface StripeSpeiSourceDto {
    id: string;                          // src_1234567890
    object: 'source';
    amount: number;
    currency: string;
    status: 'pending' | 'chargeable' | 'consumed' | 'canceled' | 'failed';
    type: 'spei';
    created: number;
    livemode: boolean;

    spei: {
        bank: string;
        clabe: string;                   // 18 dígitos
        reference: string;
    };

    // Expiración
    expires_at: number;                  // Unix timestamp
}

export interface StripeErrorResponse {
    error: {
        type: string;
        code: string;
        message: string;
        param?: string;
        decline_code?: string;
    };
}
