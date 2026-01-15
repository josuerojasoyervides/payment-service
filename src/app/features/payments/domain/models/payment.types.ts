export type PaymentProviderId = 'stripe' | 'paypal' | 'square';

export type PaymentMethodType = 'card' | 'spei';

export type PaymentStatus = 
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'succeeded'
    | 'failed'
    | 'canceled';

export interface CreatePaymentRequest {
    orderId: string;
    amount: number;
    currency: string;
    method: {
        type: PaymentMethodType;
        token?: string;
    }
}

export interface PaymentIntent {
    id: string;
    provider: PaymentProviderId;
    status: PaymentStatus;
    amount: number;
    currency: string;
    
    clientSecret?: string;
    redirectUrl?: string;
    raw?: unknown;
}