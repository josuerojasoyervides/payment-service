import { CurrencyCode, CreatePaymentRequest } from '../../../domain/models';
import { PaymentRequestBuilder, PaymentOptions, FieldRequirements } from '../../../domain/ports';

/**
 * Builder específico para pagos con tarjeta vía Stripe.
 * 
 * Este builder SABE que Stripe card necesita:
 * - token (REQUERIDO) - El token de Stripe Elements
 * - saveForFuture (OPCIONAL) - Si guardar el método para futuro uso
 * 
 * NO necesita:
 * - returnUrl (Stripe maneja 3DS internamente)
 * - cancelUrl
 * - customerEmail (opcional, Stripe lo obtiene del token)
 */
export class StripeCardRequestBuilder implements PaymentRequestBuilder {
    private orderId?: string;
    private amount?: number;
    private currency?: CurrencyCode;
    private token?: string;
    private saveForFuture?: boolean;

    /**
     * Requisitos de campos para Stripe Card.
     * 
     * @deprecated Este campo estático ya no se usa. 
     * Las factories ahora generan FieldRequirements dinámicamente usando i18n.
     * Ver: StripeProviderFactory.getFieldRequirements()
     */
    static readonly FIELD_REQUIREMENTS: FieldRequirements = {
        description: 'Pago con tarjeta de crédito o débito', // Deprecated: usar i18n
        instructions: 'Ingresa los datos de tu tarjeta de forma segura', // Deprecated: usar i18n
        fields: [
            {
                name: 'token',
                label: 'Token de tarjeta', // Deprecated: usar i18n
                required: true,
                type: 'hidden',
                placeholder: '',
            },
            {
                name: 'saveForFuture',
                label: 'Guardar tarjeta para futuras compras', // Deprecated: usar i18n
                required: false,
                type: 'text',
                defaultValue: 'false',
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

    /**
     * Recibe las opciones genéricas y extrae las que necesita Stripe Card.
     */
    withOptions(options: PaymentOptions): this {
        // Extraer solo lo que Stripe Card necesita
        if (options.token !== undefined) {
            this.token = options.token;
        }
        if (options.saveForFuture !== undefined) {
            this.saveForFuture = options.saveForFuture;
        }
        // Ignora returnUrl, cancelUrl, customerEmail - no los necesita
        return this;
    }

    build(): CreatePaymentRequest {
        this.validate();

        return {
            orderId: this.orderId!,
            amount: this.amount!,
            currency: this.currency!,
            method: {
                type: 'card',
                token: this.token,
            },
            // Metadata para datos específicos de Stripe
            metadata: {
                saveForFuture: this.saveForFuture,
            },
        };
    }

    /**
     * Validación específica para Stripe Card.
     */
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
        // VALIDACIÓN ESPECÍFICA DE STRIPE CARD
        if (!this.token) {
            throw new Error(
                'Stripe card payments require a token. ' +
                'Use Stripe Elements to tokenize the card first.'
            );
        }
    }
}
