import { PaymentMethodType, PaymentProviderId, CurrencyCode } from './payment.types';

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
    providerId: PaymentProviderId;
    returnUrl?: string;
}

export interface CancelPaymentRequest {
    intentId: string;
    providerId: PaymentProviderId;
}

export interface GetPaymentStatusRequest {
    intentId: string;
    providerId: PaymentProviderId;
}