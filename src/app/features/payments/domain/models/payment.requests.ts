import { PaymentMethodType, CurrencyCode } from './payment.types';

export interface CreatePaymentRequest {
    orderId: string;
    amount: number;
    currency: CurrencyCode;
    method: {
        type: PaymentMethodType;
        token?: string;
    };
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