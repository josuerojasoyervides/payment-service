import { CurrencyCode, CreatePaymentRequest } from '../../../domain/models';
import { PaymentRequestBuilder, PaymentOptions } from '../../../domain/ports';

/**
 * Builder for SPEI payments via Stripe.
 * 
 * This builder knows that Stripe SPEI needs:
 * - customerEmail (REQUIRED) - To send payment instructions
 * 
 * Does NOT need:
 * - token (SPEI doesn't use tokenization)
 * - returnUrl (No redirect)
 * - saveForFuture (Not applicable to SPEI)
 */
export class StripeSpeiRequestBuilder implements PaymentRequestBuilder {
    private orderId?: string;
    private amount?: number;
    private currency?: CurrencyCode;
    private customerEmail?: string;


    forOrder(orderId: string): this {
        this.orderId = orderId;
        return this;
    }

    withAmount(amount: number, currency: CurrencyCode): this {
        this.amount = amount;
        this.currency = currency;
        return this;
    }

    withOptions(options: PaymentOptions): this {
        if (options.customerEmail !== undefined) {
            this.customerEmail = options.customerEmail;
        }
        return this;
    }

    build(): CreatePaymentRequest {
        this.validate();

        return {
            orderId: this.orderId!,
            amount: this.amount!,
            currency: this.currency!,
            method: {
                type: 'spei',
            },
            customerEmail: this.customerEmail,
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
        if (!this.customerEmail) {
            throw new Error(
                'SPEI payments require customerEmail. ' +
                'The payment instructions will be sent to this email.'
            );
        }
        if (!this.customerEmail.includes('@')) {
            throw new Error('customerEmail must be a valid email address');
        }
    }
}
