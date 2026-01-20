import { PaymentMethodType, CurrencyCode } from './payment-intent.types';

/**
 * Request genérico para crear un pago.
 * 
 * Contiene campos comunes a todos los providers.
 * Cada provider usa los campos que necesita e ignora el resto.
 * 
 * La validación de qué campos son requeridos para cada
 * combinación provider+method ocurre en el Builder específico.
 */
export interface CreatePaymentRequest {
    // === Campos REQUERIDOS por todos ===
    orderId: string;
    amount: number;
    currency: CurrencyCode;
    method: {
        type: PaymentMethodType;
        token?: string;           // Para card (Stripe)
    };
    
    // === Campos OPCIONALES según provider/method ===
    returnUrl?: string;           // Para flujos redirect (PayPal)
    cancelUrl?: string;           // Para flujos redirect (PayPal)
    customerEmail?: string;       // Para recibos (SPEI, OXXO)
    
    // === Extensión para datos específicos de provider ===
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