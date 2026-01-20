import { PaymentMethodType, CurrencyCode } from './payment-intent.types';

/**
 * Generic request to create a payment.
 * 
 * Contains fields common to all providers.
 * Each provider uses the fields it needs and ignores the rest.
 * 
 * Validation of which fields are required for each
 * provider+method combination happens in the specific Builder.
 */
export interface CreatePaymentRequest {
    orderId: string;
    amount: number;
    currency: CurrencyCode;
    method: {
        type: PaymentMethodType;
        token?: string;
    };
    
    returnUrl?: string;
    cancelUrl?: string;
    customerEmail?: string;
    
    metadata?: Record<string, unknown>;
}

export interface ConfirmPaymentRequest {
    intentId: string;
    returnUrl?: string;
}

export interface CancelPaymentRequest {
    intentId: string;
}

export interface GetPaymentStatusRequest {
    intentId: string;
}