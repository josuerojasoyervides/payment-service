import { CurrencyCode, PaymentMethodType } from '../models/payment.types';
import { CreatePaymentRequest } from '../models/payment.requests';

/**
 * Builder GENÉRICO para crear payment requests.
 * 
 * NOTA: Este builder es para uso directo cuando NO usas el sistema
 * de Factories. Para uso con providers específicos, usa:
 * 
 * ```typescript
 * const factory = registry.get('stripe');
 * const builder = factory.createRequestBuilder('card');
 * ```
 * 
 * El builder específico del provider sabe exactamente qué campos
 * necesita y valida correctamente.
 * 
 * @deprecated Prefiere usar factory.createRequestBuilder(method)
 */
export class CreatePaymentRequestBuilder {
    private orderId?: string;
    private amount?: number;
    private currency?: CurrencyCode;
    private methodType?: PaymentMethodType;
    private token?: string;

    forOrder(orderId: string): this {
        this.orderId = orderId;
        return this;
    }

    withAmount(amount: number, currency: CurrencyCode): this {
        this.amount = amount;
        this.currency = currency;
        return this;
    }

    payWithCard(token: string): this {
        this.methodType = 'card';
        this.token = token;
        return this;
    }

    payWithSpei(): this {
        this.methodType = 'spei';
        return this;
    }

    build(): CreatePaymentRequest {
        this.validate();

        return {
            orderId: this.orderId!,
            amount: this.amount!,
            currency: this.currency!,
            method: {
                type: this.methodType!,
                token: this.token
            },
        };
    }

    private validate(): void {
        if (!this.orderId) {
            throw new Error('orderId is required');
        }
        if (!this.amount || this.amount <= 0) {
            throw new Error('amount must be greater than 0');
        }
        if (!this.currency) {
            throw new Error('currency is required');
        }
        if (!this.methodType) {
            throw new Error('methodType is required');
        }
        if (this.methodType === 'card' && !this.token) {
            throw new Error('card payments require a token');
        }
    }
}