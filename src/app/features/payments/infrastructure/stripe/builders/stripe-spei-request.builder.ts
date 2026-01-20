import { CurrencyCode, CreatePaymentRequest } from '../../../domain/models';
import { PaymentRequestBuilder, PaymentOptions, FieldRequirements } from '../../../domain/ports';

/**
 * Builder específico para pagos con SPEI vía Stripe.
 * 
 * Este builder SABE que Stripe SPEI necesita:
 * - customerEmail (REQUERIDO) - Para enviar instrucciones de pago
 * 
 * NO necesita:
 * - token (SPEI no usa tokenización)
 * - returnUrl (No hay redirect)
 * - saveForFuture (No aplica a SPEI)
 */
export class StripeSpeiRequestBuilder implements PaymentRequestBuilder {
    private orderId?: string;
    private amount?: number;
    private currency?: CurrencyCode;
    private customerEmail?: string;

    /**
     * Requisitos de campos para Stripe SPEI.
     */
    static readonly FIELD_REQUIREMENTS: FieldRequirements = {
        description: 'Transferencia bancaria SPEI',
        instructions: 'Recibirás instrucciones de pago en tu correo electrónico',
        fields: [
            {
                name: 'customerEmail',
                label: 'Correo electrónico',
                required: true,
                type: 'email',
                placeholder: 'tu@email.com',
            },
        ],
    };

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
        // SPEI solo necesita email
        if (options.customerEmail !== undefined) {
            this.customerEmail = options.customerEmail;
        }
        // Ignora token, returnUrl, etc. - no los necesita
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
        // VALIDACIÓN ESPECÍFICA DE SPEI
        if (!this.customerEmail) {
            throw new Error(
                'SPEI payments require customerEmail. ' +
                'The payment instructions will be sent to this email.'
            );
        }
        // Validar formato de email básico
        if (!this.customerEmail.includes('@')) {
            throw new Error('customerEmail must be a valid email address');
        }
    }
}
